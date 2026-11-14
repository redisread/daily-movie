# Engineering decisions

## 原子写与并发

D1 `batch()` 是SQLite事务，任一语句失败会整批回滚（核对2026-11-06官方D1Database文档）。不发送不被D1支持的手写BEGIN/COMMIT。

单次写入顺序：清理过期receipt → 插入唯一(method,path,key)预约 → 事务内版本断言 → 业务变更与嵌套金句 → SQLite生成完整响应JSON与ETag写入receipt → 清空断言 → 读取receipt。所有步骤同一batch。版本断言表使用NOT NULL + CHECK(ok=1)，不存在资源的NULL也不能误通过。

PATCH在外部校验schema/发布完整性之后，事务中再次校验版本；金句变化也递增父电影版本，防止发布校验基于过时的金句快照。对同key的并发预约，失败方读取获胜方已提交的receipt；不同payload则409。receipt原文由SQL从当次事务数据构造，不在提交后再查询并捕获别人的后续改动。重试先查receipt，再看If-Match，避免已成功PATCH重试被误判过期。

同片NFC文本唯一；不同key并发增加同一句时，失去竞争的一方最多重读两次，返回现有金句而不是制造重复。不同影片可用同句。没有进程内幂等或限流真源。

## 渲染与SEO

Worker用React renderToString/StaticRouter输出完整首屏、标题/description/OG/canonical和可索引内容，随后客户端用同一公开seed进行hydrateRoot。CSS Modules采用固定dm_前缀和生成映射，保证Worker与Vite使用同一类名；styles:check阻止映射漂移。策展Markdown仅在用户展开笔记后延迟加载，不阻塞首页。未知/草稿/未来id服务器真实404；客户端导航后重新读API。客户端写密钥不存在。

首页最多12项，片库cursor分页；上海日期控制可见。动态内容API和SSR页面统一no-store；公开API仍带Vary: Authorization。撤下后的响应不缓存。静态资源可缓存。不直接抓取传入媒体URL。Markdown只用ReactMarkdown、跳过原HTML并限制链接协议。CSP禁止脚本/iframe嵌入。旧service worker只做一次注销/缓存清除。

## 本地 / 远端边界

本地脚本显式使用wrangler.local.jsonc，DB UUID是占位且无生产route；默认wrangler.jsonc是正式目标daily-movie及已核实专用D1，初始WRITES_PAUSED=1。缺失或不正确的暂停状态一律拒写，只有显式0才开放。数据库和API均在真实workerd+SQLite的Miniflare里测试，不是内存mock。导入源Markdown保留在Git，但运行时只读D1。首次导入verification比较每个字段、正文和金句稳定id/次序；缺省可空字段按SQL NULL统一，不丢内容。重复导入不覆盖已存在id的API更新；已运营库再次导入前先导出和显式审核差异。

当前main已经是Worker，不能照旧文档再做Pages迁移。生产Worker名/域名与D1 ID以wrangler.jsonc为准。旧发布记录将Pi列为唯一远端操作人；针对Daily Movie task #65，用户在#proj-daily-movie msg=5069ce41明确授权Jeff闭环生产迁移、部署和指定十条状态变更，该授权仅限此任务并在关闭时到期，不扩展到其他项目。task #65上线前仍须完成生产快照、迁移账本/实际schema核对、字段级迁移验证及PR/CI；不读取或更换现有生产密钥。

## 验证边界

自动测试覆盖真实D1并发/事务/鉴权/输入安全、重复导入、运行时重启持久化，以及浏览器多断点、切换/键盘/拖动/少量数据/错误态。生产控制台日志、远程D1持久化、指定网络设备LCP/CLS、真实读屏软件仍需在对应环境验收。不能把本地PASS写成生产PASS。
