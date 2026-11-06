# Production cutover: explicit approval required

状态：**未执行**。仅本地实现/导入/测试。当前生产已是名为daily-movie的Worker，域名daily-movie.jiahongw.com；不是Pages。当前本地配置刻意不绑定生产域名或真实数据库。

## 批准前提交的影响清单

1. 固定最终源代码SHA和现有Worker deployment/version id，保留原配置、构建资产、当前所有源Markdown的清单/hash。通过控制台或已授权只读CLI核实自动Build配置，不能凭旧记忆推断。
2. 明确待创建D1名称、环境、费用/备份、所有者，批准后再创建。生成单独生产配置：Worker保持原名和现有domain，main改worker/index.ts，assets改dist，新增已批准D1绑定。不要用本地占位UUID发布。
3. 设置CONTENT_API_KEY（高熵值，仅secret）和WRITES_PAUSED=1；不得把真实值贴线程。通过受限测试环境先演练同构配置和导入。
4. 从冻结的12篇或切换时实际全部Markdown生成清单，导入测试D1，执行两轮导入及逐字段比对；不得硬编码条目数。当切换时内容有增量，重新导出、比对后再决定。
5. 明确新路由/movies/:id，旧/movie/:date、RSS和movies.json将不再可用，这是用户已接受的破坏性变更。无需旧版适配。
6. 报告最终Worker版本+D1绑定影响、回滚步骤、写入停机窗口及新密钥交付方式，取得人类明确批准再操作生产和合并main（main有自动Build）。

## 获批后的发布检查

保持域名绑定不动，只替换Worker应用版本并绑定新D1。先暂停外部写入，核实公开页面/健康/404/SEO/API无Key拒写，再开放写入。测试创建草稿、补一句、读取ETag、发布、公共页30秒内可见、刷新/版本重启仍保留，退出测试条目到draft（不提供DELETE）。日志只含requestId与事件，不记录密钥或正文。

## 回滚

1. 先把WRITES_PAUSED设1并验证写入503+Retry-After，停止自动Build/发布竞争；不要先回退应用再补救。
2. 通过批准的D1导出流程备份全部库及切换后新增电影/金句/receipt，保存变更清单。保留新D1，不删除或覆盖。
3. 恢复获批的旧Worker版本/资产与其原配置，现有domain不变。不要求旧版展示新D1数据；对外明确新API暂不可用，不再宣称写后可见。
4. 核对域名/响应后记录实际回滚version id和备份位置，再确定如何恢复新内容。失败时继续保留库，不反复重建。

部署执行前，必须填入并复核真实控制台版本id和正式D1信息；本文不是已演练或已获批的生产操作记录。
