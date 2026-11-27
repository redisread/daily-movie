# 每日随机推荐

北京时间每天从公开片库按影片 ID 抽一部。每个 ID 只占一个候选位置，电影与剧集均沿用现有公开片库范围。每天重新抽签，同一部可以连续入选。抽签结果存于 D1。UTC 16:00 的 Cron 与当天首个有效读取共用同一条写入语句。

首次迁移时已公开的影片当天可参选。迁移后新收录、重新公开或到达未来发布日期的影片，均在实际公开后的下一天参选。公开状态连续时，编辑或调整人工推荐状态保留原参选日。无对白条目沿用片库公开规则，可以带着空金句列表入选。

首页与 `GET /api/v1/recommendations/today` 读取同一结果，指向 `/movies/:id`。影片撤下后，D1 在原内容写与幂等回执事务中补选。没有候选时，当天记录为空，接口返回 `data: null`。首页的「往期人工推荐」入口及 `/api/v1/movies?scope=daily` 仍读取人工推荐。`/rss.xml` 和 `/movie/YYYY-MM-DD/` 仍返回 404。

## 本地验证

```sh
npm ci
npm run verify
npm run test:e2e
npm run db:migrate:local
npm run db:import:local
npm run db:verify:local
npm run deploy:dry-run
```

API 测试用真 workerd/D1 核对 0003 前后的 13 条影片、38 条金句、幂等回执、限流和断言表全字段，并覆盖午夜边界、连续两日抽中同一部、当日并发、次日参选、无对白影片、进程重启、撤回后立即补选和事务失败回滚。Chromium 验证接口、服务端首屏、客户端交互及固定详情链接。Playwright 数据库与日常预览分开储存。

## 生产切换

1. 获得本次生产迁移与发布授权，确认 PR 的固定 SHA、CI、Worker 当前版本、路由、Cron 和 D1 身份。仓库的 main 会触发 Workers Builds。预期为现有 `daily-movie` 和 `daily-movie-prod`，实际值在操作时读回比对。保留可回滚的旧 Worker 版本与计划状态。
2. 在短暂的内容写入静默窗口导出 D1，验证备份可恢复，并核对迁移账本和实际 schema。对 `movies`、`quotes`、`api_requests`、`rate_limits`、`write_assertions` 按主键做有序全字段快照。限流表可能随公开访问变化，需将由公开读取产生的变更和迁移对账分开。
3. **合并前**只应用已审定的 `0003_daily_recommendations.sql`，核对账本与实际新增表、索引、触发器。正式目标的待执行清单应只有 0003，已有 DDL 或其他差异先核清。影片、引文和人工推荐字段逐行一致，既有公开影片参选日为迁移当天，未来上映条目次日参选，历史抽签表初始为空。旧 Worker 可继续在追加迁移后的 D1 上工作。
4. 合并已审 SHA，观察 Workers Builds 到部署成功。核对现有域名、绑定和 UTC 16:00 Cron。访问首页和今日接口，确认同日一致、链接到固定详情、重复读取不重抽。交叉检查人工推荐、公开片库、引文、健康和两条旧路径 404。第一个自然北京时间零点复核 Cron 执行记录，以及当天只有一条已提交的抽签记录。
5. 若应用回归失败，按发布权限恢复已记录的 Worker 版本，并将 Cron 恢复为原先的配置。0003 是追加迁移，保留其表、记录和触发器。原 Worker 兼容该 schema，回滚无需丢弃运营新增内容。修复后重新验证并记录实际上线或回滚的版本。

Cloudflare 文档。[D1 事务批处理](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) · [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
