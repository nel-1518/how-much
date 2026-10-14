# 这个多少钱 · how-much

一个面向 **《最终幻想 14》国服** 的轻量物品行情查询工具。

把国服物品列表内置到本地，配合 Universalis 的公开行情接口与自建的历史统计服务，用来快速查询物品的**出售挂单、交易历史、价格走势和购买建议**。

> 在线访问：<https://nel-1518.github.io/how-much/>

## 功能特性

- **本地物品搜索**：物品列表内置为 JSON 并在 `localStorage` 中做版本化缓存，新版本静默下载、下载失败自动降级旧缓存，搜索不依赖网络。
- **单物品查价**：查看出售挂单与交易历史（历史按需懒加载），支持 NQ / HQ 切换与出售列表「含税价」换算（市场板手续费 5%）。
- **价格走势与购买建议**：基于历史成交数据绘制走势图，并给出推荐购买 / 谨慎观望 / 不推荐的评级与参考价。
- **批量查价**：一次最多 100 件物品，按行粘贴物品名自动精确匹配，汇总最低价、品质、服务器、成交均价与更新时间；支持保存物品集合、载入与导出。
- **查询范围**：可选「中国全服 / 大区 / 单个服务器」，并分别记忆各大大区下最近选择的服务器。
- **搜索历史**：普通历史 + 固定置顶，可删除或清空；桌面端提供可拖拽宽度的历史侧栏。
- **URL 直达**：通过 `?item=` 与 `?world=` 参数直接打开指定物品与查询范围（详见下文）。
- **键盘优先**：粘贴即搜、字母唤起搜索卡片、`Tab` 开关卡片等（见「快捷键」）。
- **主题与显示**：跟随系统 / 浅色 / 深色三种主题，金额支持千分位与四位空格两种格式。

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8（含 React Compiler） |
| UI | Ant Design 6 + @ant-design/icons |
| 图表 | Chart.js |
| 时间 | dayjs |
| 校验 | ESLint + typescript-eslint |

## 数据来源

- **物品列表**：[ffxiv-datamining-mixed](https://github.com/InfSein/ffxiv-datamining-mixed) 的 [`chs/Item.csv`](https://github.com/InfSein/ffxiv-datamining-mixed/blob/master/chs/Item.csv)，经脚本转换为 `public/data/item-db.json`。
- **实时行情**：[Universalis API](https://docs.universalis.app/)（出售挂单、交易历史、批量聚合）。
- **历史统计**：自建服务 `https://ffxiv-api.neeeel.com`（每日均价走势、购买建议统计）。

## 快速开始

要求 Node.js 22.18+（Babel 8 的最低要求）。

本仓库使用 **pnpm** 作为包管理器（见 `package.json` 的 `packageManager` 字段与 `pnpm-lock.yaml`），请勿再生成 `package-lock.json`。

```bash
pnpm install     # 安装依赖
pnpm dev         # 启动开发服务器（默认 http://localhost:5173）
```

### 可用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Vite 开发服务器（`0.0.0.0:5173`） |
| `pnpm build` | 类型检查并构建，产出到 `dist/`（用于子路径部署） |
| `pnpm build:root` | 以根路径 `--base=/` 构建 |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm lint` | 运行 ESLint 检查 |

> **工具链别名说明**：`package.json` 中 `typescript` 通过 npm alias 指向 `@typescript/typescript6`（JS 版编译器，构建用），`@typescript/native` 指向 `typescript@7`（Go 原生编译器）。这些别名是刻意配置，不是笔误。

> 项目的 Vite `base` 默认配置为 `/how-much/`，若部署在根路径请使用 `build:root`。

## 目录结构

```
how-much/
├─ public/
│  └─ data/                 # 生成的物品列表（item-db.json / item-db.version.json）
├─ scripts/
│  ├─ Item.csv              # 原始 CSV（脚本下载/生成）
│  └─ process-items.cjs     # CSV → JSON 转换脚本
├─ src/
│  ├─ components/           # 页面与弹窗组件（顶部导航、搜索卡片、价格区、批量区等）
│  ├─ hooks/                # 业务逻辑：物品库、查价、批量查价、历史、区间、设置等
│  ├─ utils/                # 纯函数与 API 封装：统计、购买建议、价格格式化、URL 拼接
│  ├─ assets/               # 大区图标等静态资源
│  ├─ App.tsx               # 应用主入口与全局键盘/粘贴逻辑
│  ├─ AppWrapper.tsx        # 主题与 Ant Design 配置
│  ├─ constants.ts          # 大区/服务器映射、服务地址、常量
│  ├─ storage.ts            # localStorage 统一读写（how-much: 前缀）
│  ├─ columns.tsx / types.ts
│  └─ styles/
└─ .github/workflows/deploy.yml  # GitHub Pages 自动部署
```

## 重新生成物品数据

物品列表来自 `chs/Item.csv`，通过脚本转换：

```bash
node scripts/process-items.cjs [输出目录]
```

脚本会按顺序尝试多个下载源获取 `Item.csv`，随后交互式选择过滤模式（`all` / `trade` / `search`，默认 `search`），产出：

- `item-db.json` —— 物品数组 `[{ id, name, hq }]`
- `item-db.version.json` —— 版本信息 `{ version, itemCount, generated }`

将生成的文件放入 `public/data/` 即可。前端通过版本号比对决定是否需要重新下载并缓存。

## URL 直达

支持通过地址栏参数直接打开物品并指定查询范围：

```
/?item=<物品ID 或 名称>&world=<服务器ID / 服务器名 / 大区名 / 中国>
```

- `item`、`world` 均可为数字 ID 或文字名称（名称优先精确匹配，其次取首个模糊匹配）。
- 仅给 `item` 时，沿用上次保存的查询范围。
- 只给 `world` 而无 `item` 时无效。
- 参数消费后会自动从地址栏清除，避免刷新重复触发。

## 快捷键

| 按键 | 作用 |
| --- | --- |
| `Ctrl/Cmd + V` | 在页面空白处粘贴物品名直接查价（唯一精确匹配时立即查询） |
| `Tab` | 打开 / 关闭搜索卡片 |
| 字母 / 数字 | 唤起搜索卡片并输入 |
| `↑` `↓` | 切换搜索结果 |
| `Enter` | 选择结果 |
| `Esc` | 关闭搜索卡片 |
| `` ` `` | 打开 / 关闭历史侧栏 |

## 部署

仓库已配置 GitHub Actions（`.github/workflows/deploy.yml`）：向 `master` 分支推送或手动触发时，自动执行 `pnpm build` 并部署到 GitHub Pages。
