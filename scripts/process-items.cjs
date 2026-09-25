/**
 * FFXIV 物品数据 CSV → JSON 转换脚本
 *
 * 用法:
 *   node scripts/process-items.js [输出目录]
 *
 * 数据源（按顺序尝试，第一个成功即用）:
 *   https://raw.githubusercontent.com/InfSein/ffxiv-datamining-mixed/master/chs/Item.csv
 *   https://cdn.jsdelivr.net/gh/InfSein/ffxiv-datamining-mixed@master/chs/Item.csv
 *   https://fastly.jsdelivr.net/gh/InfSein/ffxiv-datamining-mixed@master/chs/Item.csv
 *
 * 运行后会交互式选择过滤模式:
 *   all    —— 只过滤名称为空 / ID 为空的行
 *   trade  —— 在 all 基础上过滤 IsUntradable 为 true 的物品
 *   search —— 在 trade 基础上过滤 ItemSearchCategory 为 0 的物品（默认）
 *
 * 默认输出到当前目录（运行 node 时所在的目录）
 *
 * 生成文件（输出目录下）:
 *   Item.csv                 — 下载的原始 CSV
 *   item-db.json             — 物品数据 [{ id, name, hq }]
 *   item-db.version.json     — 版本信息 { version, itemCount, generated }
 *
 * CSV 格式说明:
 *   - 第1行: 列索引 (0,1,2,...)
 *   - 第2行: 列名 (#,Singular,Adjective,...)
 *   - 第3行: 数据类型 (int32,str,sbyte,...)
 *   - 第4行起: 实际数据
 *
 * 输出:
 *   - 仅保留: id, name, hq（CanBeHq: FALSE=0, TRUE=1）
 *   - 过滤规则随所选模式（all / trade / search）变化
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ====== 配置 ======
const TARGET_COLUMNS = ['#', 'Name', 'Description', 'IsUntradable', 'CanBeHq', 'ItemSearchCategory'];
const CSV_DELIMITER = ',';

// 数据源：FFXIV datamining 中文物品表（按顺序尝试，第一个成功即用）
const CSV_URLS = [
  'https://raw.githubusercontent.com/InfSein/ffxiv-datamining-mixed/master/chs/Item.csv',
  'https://cdn.jsdelivr.net/gh/InfSein/ffxiv-datamining-mixed@master/chs/Item.csv',
  'https://fastly.jsdelivr.net/gh/InfSein/ffxiv-datamining-mixed@master/chs/Item.csv',
];
const CSV_FILE_NAME = 'Item.csv';

// 过滤模式（层级递进：search ⊃ trade ⊃ all）
const FILTER_MODES = ['all', 'trade', 'search'];
const DEFAULT_FILTER_MODE = 'search';

// 默认输出路径：当前工作目录（运行 node 时所在的目录）
const DEFAULT_OUT_DIR = process.cwd();

// ====== 下载 CSV ======
async function downloadCsv(urls, targetPath) {
  let lastErr = null;
  for (const url of urls) {
    console.log(`⏳ 正在下载: ${url}`);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(targetPath, buf);
      console.log(`✔ 已下载: ${targetPath}（${(buf.length / 1024 / 1024).toFixed(2)} MB）\n`);
      return;
    } catch (err) {
      lastErr = err;
      const reason = err.cause ? `${err.message} (${err.cause.code || err.cause.message})` : err.message;
      console.warn(`⚠ 下载失败，尝试下一个源: ${reason}`);
    }
  }
  throw new Error(`所有下载源均失败: ${lastErr ? lastErr.message : '未知错误'}`);
}

// ====== 交互式选择过滤模式 ======
function askFilterMode() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const prompt = [
      '请选择过滤模式:',
      '  all    —— 只过滤名称为空 / ID 为空的行',
      '  trade  —— 在 all 基础上过滤 IsUntradable 为 true 的物品',
      '  search —— 在 trade 基础上过滤 ItemSearchCategory 为 0 的物品',
      `请输入 (all/trade/search，直接回车默认 ${DEFAULT_FILTER_MODE}): `,
    ].join('\n');

    rl.question(`${prompt}\n> `, (answer) => {
      rl.close();
      const normalized = (answer || '').trim().toLowerCase();
      if (normalized === '') {
        console.log(`未选择，使用默认模式: ${DEFAULT_FILTER_MODE}`);
        resolve(DEFAULT_FILTER_MODE);
        return;
      }
      if (!FILTER_MODES.includes(normalized)) {
        console.warn(`⚠ 无效输入 "${normalized}"，使用默认模式: ${DEFAULT_FILTER_MODE}`);
        resolve(DEFAULT_FILTER_MODE);
        return;
      }
      resolve(normalized);
    });
  });
}

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

// ====== 主逻辑 ======

function main() {
  return run();
}

async function run() {
  const args = process.argv.slice(2);

  const outDir = args[0] ? path.resolve(args[0]) : DEFAULT_OUT_DIR;

  // 确保输出目录存在
  fs.mkdirSync(outDir, { recursive: true });

  // 下载 CSV 到输出目录
  const inputPath = path.join(outDir, CSV_FILE_NAME);
  await downloadCsv(CSV_URLS, inputPath);

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

  // 交互式选择过滤模式
  const mode = await askFilterMode();
  console.log(`✔ 已选择过滤模式: ${mode}\n`);

  for (let i = 3; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (line.length === 0) continue;

    const fields = parseCSVLine(line);

    const id = fields[columnMap['#']] || '';
    const name = fields[columnMap['Name']] || '';
    const isUntradable = (fields[columnMap['IsUntradable']] || '').trim().toUpperCase() === 'TRUE';
    const canBeHq = (fields[columnMap['CanBeHq']] || '').trim().toUpperCase() === 'TRUE';
    const itemSearchCategory = (fields[columnMap['ItemSearchCategory']] || '').trim();

    // all: 跳过 ID 为空 / 名称为空的行
    if (id === '') continue;
    if (name === '') continue;

    // trade 及以上: 跳过不可交易物品
    if (mode !== 'all' && isUntradable) continue;

    // search: 跳过 ItemSearchCategory 为 0 的物品（不在市场分类中，无法被搜索）
    if (mode === 'search' && (itemSearchCategory === '' || itemSearchCategory === '0')) continue;

    items.push({
      id: parseInt(id, 10),
      name,
      hq: canBeHq ? 1 : 0,
    });
  }

  // 生成版本信息
  const now = new Date();
  const version = computeVersion(items, now);

  // 写入物品数据 JSON
  const dataPath = path.join(outDir, 'item-db.json');
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
}

main().catch((err) => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});
