/**
 * FFXIV 物品数据 CSV → JSON 转换脚本
 *
 * 用法:
 *   node scripts/process-items.js <输入CSV路径>
 *
 * 默认输出到 public/data/ 目录（在项目根目录下运行）
 *
 * 生成文件:
 *   public/data/item-db.json          — 物品数据 [{ id, name, description, hq }]
 *   public/data/item-db.version.json  — 版本信息 { version, itemCount, generated }
 *   public/data/new-items.json        — 本次新增物品（与上次 item-db.json 相比多出的条目，按 id 对比）
 *   public/data/removed-items.json    — 本次移除物品（上次存在但本次 CSV 已无的条目，按 id 对比）
 *
 * 新增/移除的展示方式（MAX_INLINE_DELTA = 20）:
 *   - 数量 ≤ 20 条: 在命令行逐行显示（不写文件，并清理上一轮遗留的增量文件）
 *   - 数量 > 20 条: 写入上方对应的固定文件
 *
 * CSV 格式说明:
 *   - 第1行: 列索引 (0,1,2,...)
 *   - 第2行: 列名 (#,Singular,Adjective,...)
 *   - 第3行: 数据类型 (int32,str,sbyte,...)
 *   - 第4行起: 实际数据
 *
 * 输出:
 *   - 仅保留: id, name, hq（CanBeHq: FALSE=0, TRUE=1）
 *   - 过滤: IsUntradable 为 true 的物品将被跳过，名称为空的物品将被跳过，ID 为 1 的物品将被跳过
 */

const fs = require('fs');
const path = require('path');

// ====== 配置 ======
const TARGET_COLUMNS = ['#', 'Name', 'Description', 'IsUntradable', 'CanBeHq'];
const CSV_DELIMITER = ',';

// 新增/移除增量输出阈值：数量 ≤ 该值时在命令行逐行显示（不写文件），超过才写入文件
const MAX_INLINE_DELTA = 20;

// 默认输出路径：脚本位于 scripts/，项目根目录的 public/data/
const DEFAULT_OUT_DIR = path.resolve(__dirname, '..', 'public', 'data');

// ====== CSV 解析（支持引号内换行） ======

/**
 * 将整个 CSV 文本拆分成行数组，正确处理引号内的换行符
 */
function splitCSVLines(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '""';
          i++;
        } else {
          inQuotes = false;
          current += '"';
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        current += '"';
      } else if (ch === '\n') {
        lines.push(current);
        current = '';
      } else if (ch === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        lines.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

/**
 * 解析一行 CSV，处理引号包裹的字段
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === CSV_DELIMITER) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/**
 * 生成简短的版本标识
 * 格式: YYYYMMDD-条目数-内容前100字符的简短摘要
 */
function computeVersion(items, generatedTime) {
  const dateStr = generatedTime.toISOString().slice(0, 10).replace(/-/g, '');
  const count = items.length;
  // 取 JSON 前 100 个字符的简单哈希
  const sample = JSON.stringify(items).slice(0, 100);
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    const chr = sample.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString(36).slice(0, 6);
  return `${dateStr}-${count}-${hashStr}`;
}

/**
 * 读取 JSON 文件，若文件不存在或解析失败返回 null
 */
function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`⚠ 读取 ${filePath} 失败（${err.message}），跳过对比`);
    return null;
  }
}

/**
 * 输出新增/移除的增量结果
 *  - 数量 ≤ MAX_INLINE_DELTA：在命令行逐行显示（不写文件，并清理上一轮可能遗留的增量文件）
 *  - 数量 >  MAX_INLINE_DELTA：写入固定文件（new-items.json / removed-items.json）
 */
function outputDelta(deltaItems, label, filePath) {
  const count = deltaItems.length;

  if (count === 0) {
    console.log(`✔ 本次${label}: 0 条`);
    return;
  }

  if (count <= MAX_INLINE_DELTA) {
    console.log(`✔ 本次${label}: ${count} 条（逐行显示）`);
    for (const it of deltaItems) {
      console.log(`   ${it.id} ${it.name}`);
    }
    // 清理上一轮写入的增量文件，避免小变更时不写文件却残留上一轮的大文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`   （已删除上一轮遗留文件: ${filePath}）`);
    }
    return;
  }

  fs.writeFileSync(filePath, JSON.stringify(deltaItems, null, 2), 'utf-8');
  console.log(`✔ 本次${label}: ${count} 条（已写入文件）`);
  console.log(`   ${filePath}`);
}

// ====== 主逻辑 ======

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('用法: node scripts/process-items.js <输入CSV路径>');
    console.error('输出到 public/data/ 目录');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outDir = args[1] ? path.resolve(args[1]) : DEFAULT_OUT_DIR;

  if (!fs.existsSync(inputPath)) {
    console.error(`错误: 文件不存在 — ${inputPath}`);
    process.exit(1);
  }

  // 确保输出目录存在
  fs.mkdirSync(outDir, { recursive: true });

  const text = fs.readFileSync(inputPath, 'utf-8');
  const rawLines = splitCSVLines(text);

  if (rawLines.length < 3) {
    console.error('错误: CSV 文件至少需要 3 行（索引、列名、数据类型）');
    process.exit(1);
  }

  // 第1行: 列索引，跳过 (rawLines[0])
  // 第2行: 列名 (rawLines[1])
  const headers = parseCSVLine(rawLines[1]);
  const columnMap = {};
  for (let i = 0; i < headers.length; i++) {
    columnMap[headers[i]] = i;
  }

  // 检查目标列是否存在
  for (const col of TARGET_COLUMNS) {
    if (!(col in columnMap)) {
      console.error(`警告: 列 "${col}" 未在 CSV 中找到。可用列: ${headers.join(', ')}`);
    }
  }

  // 第3行: 数据类型，跳过 (rawLines[2])
  const items = [];

  for (let i = 3; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (line.length === 0) continue;

    const fields = parseCSVLine(line);

    const id = fields[columnMap['#']] || '';
    const name = fields[columnMap['Name']] || '';
    const isUntradable = (fields[columnMap['IsUntradable']] || '').trim().toUpperCase() === 'TRUE';
    const canBeHq = (fields[columnMap['CanBeHq']] || '').trim().toUpperCase() === 'TRUE';

    // 跳过无效行（ID 为空、为 0 或为 1）
    if (id === '' || id === '0' || id === '1') continue;

    // 跳过不可交易物品
    if (isUntradable) continue;

    // 跳过名称为空的物品
    if (name === '') continue;

    items.push({
      id: parseInt(id, 10),
      name,
      hq: canBeHq ? 1 : 0,
    });
  }

  // 生成版本信息
  const now = new Date();
  const version = computeVersion(items, now);

  // ====== 增量对比：找出本次新增/移除的物品 ======
  // 必须在覆盖 item-db.json 之前读取旧数据作为基线
  const dataPath = path.join(outDir, 'item-db.json');
  const oldItems = readJsonIfExists(dataPath) || [];

  const oldById = new Map(oldItems.map((it) => [it.id, it]));
  const newIds = new Set(items.map((it) => it.id));

  const addedItems = items.filter((it) => !oldById.has(it.id));
  const removedItems = oldItems.filter((it) => !newIds.has(it.id));

  // 写入物品数据 JSON
  fs.writeFileSync(dataPath, JSON.stringify(items), 'utf-8');

  // 写入版本文件 JSON
  const versionPath = path.join(outDir, 'item-db.version.json');
  const versionData = {
    version,
    itemCount: items.length,
    generated: now.toISOString(),
  };
  fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2), 'utf-8');

  console.log(`✔ 完成！共处理 ${items.length} 条物品数据`);
  console.log(`✔ 数据文件: ${dataPath}`);
  console.log(`✔ 版本文件: ${versionPath}`);
  console.log(`✔ 版本号: ${version}`);

  // 输出本次新增/移除（有旧基线时才对比输出）
  if (oldItems.length > 0) {
    outputDelta(addedItems, '新增', path.join(outDir, 'new-items.json'));
    outputDelta(removedItems, '移除', path.join(outDir, 'removed-items.json'));
  } else {
    console.warn(`⚠ 未找到旧数据基线（${dataPath}），本次不输出新增/移除结果`);
  }
}

main();
