# 片库公开与每日推荐

Task #65 的本地实现契约。既有 `docs/rebuild-spec-v1.2.md` 是历史基线，本文件记录新增行为。

## 可见性与写规则

| 状态 | 片库 `scope=catalog` | 每日推荐 `scope=daily` | `publishedDate` |
| --- | --- | --- | --- |
| `draft` | 隐藏 | 隐藏 | 可空 |
| `listed` | 公开 | 隐藏 | 必须为 `null` |
| `published` | 日期到达后公开 | 日期到达后公开 | 必须有效；按 Asia/Shanghai 判断 |

`listed` 与 `published` 都须通过原有资料、封面及至少一条金句完整性检查；listed 不检查推荐日期，但要求日期为空。draft→listed 的 PATCH 若现有日期非空，须同时显式清空；published→listed 也须显式清空。listed→published 须同次提供推荐日期。所有变更继续走原来的强 ETag、幂等键、D1 原子写、版本和审计机制。`status=draft` 继续撤回内容。

公开列表默认 `scope=daily`，以兼容既有调用方；`/library` 显式请求 `scope=catalog`，首页选片显式请求 `scope=daily`。未知范围返回400，鉴权的 all-state 列表不能带 `scope`。游标绑定范围、q/type/status 筛选；之前创建的游标仅可继续用于 daily。排序仍为 `COALESCE(publishedDate,'') DESC,id DESC`。响应提供 `nextCursor` 与 `previousCursor`，上一页通过反向游标读取相同排序窗口。

公开列表两种范围、电影/金句详情、服务端渲染、搜索、详情导航和随机漫步均遵守 catalog 可见性，并统一响应 `Cache-Control: no-store`，让撤下后的再次请求不可复用撤下前的200内容。未来 published 与 draft 仍返回404/no-store。随机漫步遍历完整 catalog 分页。首页显式 `?movie=id` 可展示 catalog 影片，并标成“片库收录”；普通首页仍只选 daily。片库卡片不为 listed 伪造日期，展示“片库收录”。静态资源继续使用既有缓存策略。

## 本地实现范围

- `migrations/0002_listed_catalog.sql` 重建 movies 与 quotes 表，保留现有字段和值、唯一约束和外键，并扩展状态 CHECK 以及 listed 日期 CHECK。
- API、OpenAPI、Zod 与共用可见性判断实现状态和列表范围；详情导航与前后页游标遵守相同排序。
- React 片库页面、首页显式选择、SEO 服务端渲染与随机漫步使用对应范围。
- `tests/api/api.test.ts` 在 D1/Miniflare 中验证迁移保留 movie/quote 行、约束、状态切换、幂等保护、范围隔离、分页回退、动态200的no-store和公开200→撤回→404回归；共享状态及游走列表单测覆盖可见性。

## 生产数据变更计划（未执行）

基线来自 task #62 写后回读：23 movies、48 quotes；12 部现有影片公开，10 部 Top250 候选仍为 draft/null，另1部旧非公开记录保持私有。经此代码部署和独立验收后，若另获明确的生产数据变更授权：

1. 在执行时重新读取 all-state 数据，核对下面十个稳定 ID 的当前状态、版本和日期；检查完整备份包含 movie/quote 字段和关联关系。内容或数量与此计划不符就停。
2. 用受支持的内容写入 API，逐条以当前强 ETag + 每条唯一 Idempotency-Key 把且仅把十条 `draft/null` 改为 `listed/null`。不直接运行 SQL，不覆盖其他行，不重复导入。
3. 每条回读并确认 status/date/version/audit；重复核对全库数量及其他 13 条的字段摘要。预期 catalog 可见 22，daily 保持 12，quotes 保持48，旧非公开条目仍隐藏。
4. 如 API 鉴权/权限返回错误，立即停止并交由当前远端操作人处理；不得换身份、绕过保护或扩大写范围。

本次 task #65 仅含代码和本地验证，**没有**授权应用生产 migration、改变十条状态、合并、发布或部署。正式执行顺序应为：先取得单独的 schema/发布授权并做生产备份；由当期获授权的远端操作人将 `0002_listed_catalog.sql` 应用到 daily-movie-prod，核对 movies/quotes 数量、字段摘要、索引与外键；再经审查合并并发布代码，在线验证 daily/catalog 列表、详情、分页与撤下缓存；最后如再获单独的生产内容变更授权，按上表计划切换十条状态。D1 写权限不从 task #62 沿用到本次状态变更。

候选 ID：

`douban-1291548`, `douban-1291832`, `douban-1291844`, `douban-1292226`, `douban-1293181`, `douban-1293544`, `douban-1294639`, `douban-1297630`, `douban-1299131`, `douban-1300267`。

## 回滚

应用回滚前，先取得单独的数据变更授权并备份，然后用强 ETag + 幂等 API 将本次十条 `listed/null` 恢复到变更前的 `draft/null`；逐条回读并确认十条均不可见，再回滚 Worker/前端代码。若状态恢复未获授权或未完成，不回滚到不认识 `listed` 的旧代码；暂停后续写入并先处理兼容问题。保留扩展后的 D1 schema、原内容、回执与审计，不删除或重灌数据库。恢复新功能时重新发布已验收实现。若之后确需移除 schema 扩展，另行审核数据恢复和迁移计划；不在本次准备或执行 down migration。
