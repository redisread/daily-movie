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
- `GET /api/v1/recommendations/today`：北京时间今日随机推荐，与首页共用结果。
- `GET /api/v1/movies`：q/type/cursor/limit，公开默认 `scope=daily`；`scope=catalog` 返回片库收录与已到上海日期的推荐。
- `GET /api/v1/movies/:id` 与 `GET /api/v1/quotes/:id` 返回 ETag。
- `POST /api/v1/movies` 创建草稿；`POST /api/v1/movies/:id/quotes` 追加金句。
- `PATCH /api/v1/movies/:id` / `PATCH /api/v1/quotes/:id` 要求 If-Match。
- 写入要求 `Authorization: Bearer $CONTENT_API_KEY` 和 `Idempotency-Key`，请求体最多256KiB。
- 同一键/方法/路径/请求体/If-Match重试7天内返回原结果。改变载荷复用键409；更新无版本428，过期412；同片同NFC文本返回已有金句200。
- `GET /api/openapi.json` 为 OpenAPI 3.1；`GET /api/health` 检查D1。
- 动态内容列表、详情与页面统一 `no-store`，防止撤下前缓存的公开内容继续展示；静态资源仍可缓存。IP限流使用D1固定分钟计数（写40/分钟，读600/分钟），429带Retry-After。
- 前端没有写密钥输入或管理界面，构建产物不包含密钥。
- `draft` 私有；`listed` 公开进入片库且 `publishedDate=null`；`published` 进入人工推荐，未来日期到上海当天才公开。设为draft撤回；状态变更保留ETag、幂等回执和审计边界。

完整调用示例：[docs/api.md](docs/api.md)。D1原子写与边界：[docs/engineering.md](docs/engineering.md)。
片库与每日推荐的状态契约及本地上线/回滚计划：[docs/library-visibility.md](docs/library-visibility.md)。

## 每日随机推荐、随机漫步与图片修正

首页默认显示北京时间当天从公开片库抽到的一部影片，可通过「往期人工推荐」继续浏览原转盘。新公开影片次日参选，抽中后指向既有影片详情。当日影片撤下时同步补选，候选为空时留空。迁移与生产切换见 [每日推荐上线清单](docs/daily-recommendations.md)。

首页保留手动转盘，随机漫步从完整公开片库分页建池（最多1000部），洗牌袋不放回抽样；实际历史最多100条，回看后先沿原路径前进。同标签页刷新和详情返回恢复，`?movie=id&mode=walk` 分享电影而非个人路径。转盘只预览最多12部，范围另行显示；无自动播放。

响应式缩略图复用现有图片服务；图集按来源去重，不把海报标成剧照。2026-11-07修正计划、来源记录和执行边界见 [docs/random-walk-content.md](docs/random-walk-content.md)。`npm run content:plan` **只读线上D1公开API**生成前后对照，不会写入；发布前另审数据补丁，原37条金句及后续新增金句不在补丁内。

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

首轮重构上线已完成；其授权不外推至后续功能发布或生产内容写入，后续操作须确认当次范围和执行人。首次切换记录见 [切换/回滚清单](docs/cutover.md)（当时由 Pi 操作、Jeff 准备代码）。现有站在 Worker（不是 Pages），main 的 Workers Builds 会自动发布。正式配置绑定专用 daily-movie-prod；首发以 `WRITES_PAUSED=1` 完成读/鉴权核验后，配置目标现同步为 `0`（远端实值以最终发布版本为准）；远端导入核对、密钥和最终CI就绪后才合并/发布。验证后开放写入必须同步配置，避免下一次自动部署把状态覆盖。保留旧Worker版本和新D1增量，回滚先暂停写入并导出，不能丢失新内容。

网站：https://daily-movie.jiahongw.com 。不要使用被第三方占用的 `daily-movie.pages.dev`。
