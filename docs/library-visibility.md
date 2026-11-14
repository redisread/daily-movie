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

## task #65 生产发布计划

用户在 #proj-daily-movie msg=5069ce41 授权 task #65 完成生产迁移、部署和十部状态调整；这一授权仅适用于本次 Daily Movie 上线。当前线上基线经只读核对为23 movies、48 quotes：12 published、11 draft、0 listed；10部目标候选均为 draft/null，另1部旧草稿仍非公开。完整生产快照与字段级验证记录保存在agent workspace私有目录 `../../artifacts/daily-movie-library-release-2026-11-14/`，不得提交到Git。

1. 执行前再次核对D1现状和迁移记录。远端 `d1_migrations` 为空，但实际表、索引及外键已匹配0001，movies的CHECK仍只允许draft/published。已审查的迁移方案：仅把精确名称 `0001_content.sql` 登记为既有基线，不重跑其DDL；然后用标准Wrangler migration命令只应用 `0002_listed_catalog.sql`。写账本前确认库schema和空账本仍与预检一致；否则停止。
2. 迁移后核对23 movies、48 quotes、所有movie/quote字段摘要不变，索引和quotes外键正确、0 orphan，ledger仅记录0001与0002。再通过最终PR/CI和独立审查，按main自动发布新Worker。
3. 线上读路径验证通过后，使用受支持内容API，逐条以当前强ETag + 每条唯一Idempotency-Key把且仅把十条 `draft/null` 改为 `listed/null`。不直接修改业务表、不覆盖其他行、不重复导入，也不读取或更换生产密钥。
4. 每条回读确认status/date/version/audit；再核对全库数量和旧非公开记录。预期catalog 22、daily 12、quotes 48，旧非公开草稿仍隐藏。鉴权或状态与预检不符时立即停止，不换身份、不绕过保护、不扩大范围。

本次task授权覆盖上述schema迁移、合并发布和十条状态调整，范围仅task #65。生产数据修改仍须使用应用API，不借用task #62授权外的额外数据写范围。

候选 ID：

`douban-1291548`, `douban-1291832`, `douban-1291844`, `douban-1292226`, `douban-1293181`, `douban-1293544`, `douban-1294639`, `douban-1297630`, `douban-1299131`, `douban-1300267`。

## 回滚

应用回滚前，先取得单独的数据变更授权并备份，然后用强 ETag + 幂等 API 将本次十条 `listed/null` 恢复到变更前的 `draft/null`；逐条回读并确认十条均不可见，再回滚 Worker/前端代码。若状态恢复未获授权或未完成，不回滚到不认识 `listed` 的旧代码；暂停后续写入并先处理兼容问题。保留扩展后的 D1 schema、原内容、回执与审计，不删除或重灌数据库。恢复新功能时重新发布已验收实现。若之后确需移除 schema 扩展，另行审核数据恢复和迁移计划；不在本次准备或执行 down migration。
