# 每日电影 · 电影转盘

React + Vite + TypeScript 前端，同源 Cloudflare Worker HTTP API，D1 保存电影、剧集与独立金句。Agent 用普通 HTTP API + 服务端 Bearer Key 写入，无 MCP、账号后台或 OAuth。

## 本地启动

Node >=22.12，npm。**所有本地脚本显式使用 `wrangler.local.jsonc`**：仅本地占位D1、预览Worker名、无生产域名。默认 `wrangler.jsonc` 是已核实的正式生产目标，不要把生产配置当本地命令省略参数使用。

```sh
npm ci
cp .dev.vars.example .dev.vars
# 将 .dev.vars 中 CONTENT_API_KEY 替换成随机高熵值，不要提交该文件
npm run db:migrate:local
npm run db:import:local
npm run db:verify:local
npm run build
npm run preview            # http://localhost:4321，真实本地D1 + Worker + 构建前端
```

热更新开发：两个终端分别运行 `npm run dev:api`（8787）与 `npm run dev`（4321，代理 `/api`）。Vite 开发服务器仅用于UI开发，真实404/SEO必须在 `npm run preview` 的 Worker 中验收。

## 内容与 API

- 公共页面 `/`、`/library`、`/movies/:id`、`/api-docs`、`/about`。
- `GET /api/v1/movies`：q/type/cursor/limit，公开仅返回已发布且上海日期已到的条目。
- `GET /api/v1/movies/:id` 与 `GET /api/v1/quotes/:id` 返回 ETag。
- `POST /api/v1/movies` 创建草稿；`POST /api/v1/movies/:id/quotes` 追加金句。
- `PATCH /api/v1/movies/:id` / `PATCH /api/v1/quotes/:id` 要求 If-Match。
- 写入要求 `Authorization: Bearer $CONTENT_API_KEY` 和 `Idempotency-Key`，请求体最多256KiB。
- 同一键/方法/路径/请求体/If-Match重试7天内返回原结果。改变载荷复用键409；更新无版本428，过期412；同片同NFC文本返回已有金句200。
- `GET /api/openapi.json` 为 OpenAPI 3.1；`GET /api/health` 检查D1。
- 所有写响应与鉴权读no-store，公开读最多缓存30秒。IP限流使用D1固定分钟计数（写40/分钟，读600/分钟），429带Retry-After。
- 前端没有写密钥输入或管理界面，构建产物不包含密钥。
- 无DELETE；设为draft撤回。日期可版本化修改，id链接保持稳定。

完整调用示例：[docs/api.md](docs/api.md)。D1原子写与边界：[docs/engineering.md](docs/engineering.md)。

## 内容导入

`src/data/movies/*.md` 是旧内容只读备份，**不是新版本运行时数据源**。脚本严格校验、保留所有原字段和正文，生成 `artifacts/import-manifest.json` 、导入SQL和 `artifacts/import-verification.sql`（可在D1控制台逐字段核对）。按稳定电影id和金句UUID重跑不重复、不覆盖API编辑；`db:verify:local` 在首次导入库逐字段核对。无旧URL/RSS/JSON格式兼容层，旧路径返回404，见用户确认后的 [v1.2规范](docs/rebuild-spec-v1.2.md)。

## 测试

```sh
npm run verify            # lint、类型、生成绑定、真实本地D1 API/并发单测、构建
npx playwright install chromium
npm run test:e2e          # 自动本地迁移/导入并启动Worker（可复用已有本地服务）
npm run deploy:dry-run    # 只打包，不发布
npx tsx scripts/smoke-local.ts  # 仅本地：创建、补金句、发布、公开页、落盘验证，finally清理测试数据
```

## 部署安全

本轮生产上线已获明确授权，按 [切换/回滚清单](docs/cutover.md) 协调执行；远端资源、导入和发布由 Pi 唯一操作，代码准备由 Jeff 负责。现有站在 Worker（不是 Pages），main 的 Workers Builds 会自动发布。正式配置绑定专用 daily-movie-prod，初始 `WRITES_PAUSED=1`；远端导入核对、密钥和最终CI就绪后才合并/发布。验证后开放写入必须同步配置，避免下一次自动部署把状态覆盖。保留旧Worker版本和新D1增量，回滚先暂停写入并导出，不能丢失新内容。

网站：https://daily-movie.jiahongw.com 。不要使用被第三方占用的 `daily-movie.pages.dev`。
