# Engineering decisions

## 原子写与并发

D1 `batch()` 是SQLite事务，任一语句失败会整批回滚（核对2026-11-06官方D1Database文档）。不发送不被D1支持的手写BEGIN/COMMIT。

单次写入顺序：清理过期receipt → 插入唯一(method,path,key)预约 → 事务内版本断言 → 业务变更与嵌套金句 → SQLite生成完整响应JSON与ETag写入receipt → 清空断言 → 读取receipt。所有步骤同一batch。版本断言表使用NOT NULL + CHECK(ok=1)，不存在资源的NULL也不能误通过。

PATCH在外部校验schema/发布完整性之后，事务中再次校验版本；金句变化也递增父电影版本，防止发布校验基于过时的金句快照。对同key的并发预约，失败方读取获胜方已提交的receipt；不同payload则409。receipt原文由SQL从当次事务数据构造，不在提交后再查询并捕获别人的后续改动。重试先查receipt，再看If-Match，避免已成功PATCH重试被误判过期。

同片NFC文本唯一；不同key并发增加同一句时，失去竞争的一方最多重读两次，返回现有金句而不是制造重复。不同影片可用同句。没有进程内幂等或限流真源。

## 渲染与SEO

Worker用React renderToString/StaticRouter输出完整首屏、标题/description/OG/canonical和可索引内容，随后客户端用同一公开seed进行hydrateRoot。CSS Modules采用固定dm_前缀和生成映射，保证Worker与Vite使用同一类名；styles:check阻止映射漂移。策展Markdown仅在用户展开笔记后延迟加载，不阻塞首页。未知/草稿/未来id服务器真实404；客户端导航后重新读API。客户端写密钥不存在。

首页最多12项，片库cursor分页；上海日期控制可见。公开结果max-age30，鉴权no-store且公开API带Vary: Authorization。不直接抓取传入媒体URL。Markdown只用ReactMarkdown、跳过原HTML并限制链接协议。CSP禁止脚本/iframe嵌入。旧service worker只做一次注销/缓存清除。

## 本地 / 远端边界

wrangler.jsonc仅本地预览，DB UUID是占位，不含生产route。数据库和API均在真实workerd+SQLite的Miniflare里测试，不是内存mock。导入源Markdown保留在Git，但运行时只读D1。首次导入verification比较每个字段、正文和金句稳定id/次序；缺省可空字段按SQL NULL统一，不丢内容。重复导入不覆盖已存在id的API更新；已运营库再次导入前先导出和显式审核差异。

当前main已经是Worker，不能照旧文档再做Pages迁移。生产Worker当前名/域名已在原配置和Git基线保留；生产DB创建、绑定、secret与发布均需另批。代码合并不能等同上线授权。

## 验证边界

自动测试覆盖真实D1并发/事务/鉴权/输入安全、重复导入、运行时重启持久化，以及浏览器多断点、切换/键盘/拖动/少量数据/错误态。生产控制台日志、远程D1持久化、指定网络设备LCP/CLS、真实读屏软件仍需在对应环境验收。不能把本地PASS写成生产PASS。
