# Daily Movie 全量重构规范 v1.2

2026-11-06 · 产品/UI/交互交付 · 实施交接 Jeff

v1.2修订：用户msg=ec90f577明确无需兼容旧版。取消旧日期URL、旧JSON格式、RSS及旧主题兼容工作；采用 /movies/:id 详情路由。已有电影/金句仍导入，保全内容不等于保留旧接口。

v1.1修订：Jeff核对远端main（线程msg=cf8c1478）已部署为Worker。本地旧checkout的Pages配置不代表当前部署；本次为现有Worker应用替换并新增D1，不涉及Pages迁移。

## 0. 已确认范围与证据

用户要求：React + Vite 重写、数据库持久化、添加电影和金句的 HTTP API、简单鉴权、参考指定视频重做 UI/动画。无需 MCP/OAuth/用户管理平台。

本稿定稿供实现；开发需先核实工程兼容性，生产迁移及域名切换不是本稿自动授权项。

核实来源：
- 本地 daily-movie 的 CLAUDE.md、src/schemas/movie.ts、src/data/movies.ts、src/pages/*、wrangler.jsonc，2026-11-06只读检查。
- 线上首页显示12部；本地12篇 Markdown。正式迁移以切换时清单为准，不硬编码12。
- 本地旧快照为 Astro + Pages、无数据库绑定；Jeff核对远端main已为Worker，实施以远端main为准。电影字段含 movie/tv、封面/剧照可选视频、演员、3–10条金句、whyThisMovie；Markdown正文当前加载器未消费，但仍须保全。
- 旧详情路由 /movie/YYYY-MM-DD/；另有 /movies.json、/rss.xml、/health.json。
- 本地CLAUDE仍描述旧主题与Astro约束，本次用户明确要求React重写，覆盖这些框架/视觉约束；原有域名安全、数据保护约束继续有效。不要访问或切到被他人占用的 daily-movie.pages.dev。

参考：https://x.com/designbyaron/status/2118473651230331228
原帖文字“from the eddy brand archives and exercises”。直连失败、Jina仅登录页，之后从公开FxTwitter媒体元数据取得Twitter视频，时长19.816秒，按2秒抽帧确认：白底、黑色巨型编号、彩色小物件环绕、顶端橙色指示、圆环转动时编号变化。视频无法证明底层技术和触发方式；下文拖动/点击及毫秒数是本项目设计，不冒称原作参数。不得复制原作模型或品牌素材。

## 1. 产品与信息架构

主题：电影转盘，一次选中一部电影，留下一句台词。

公共页面：
- `/` 今日选片：默认选最近一个 publishedDate 不晚于上海当天的已发布条目。无今日更新时显示真实日期，不把旧内容伪称今天新增。
- `/library` 片库：名称搜索、movie/tv筛选、日期倒序，20条分页，查询状态写URL。
- `/movies/:id` 新版稳定详情链接：完整资料、剧照、策展文、所有金句、前后条目。
- `/api-docs` 简短使用说明及OpenAPI下载，无登录或输入密钥UI。
- `/about` 项目说明、来源与版权反馈方式，沿用现有真实联系方式，不臆造。
- 未知电影id/路由返回真正404，给“返回片库”。

不新增用户账号、收藏数据库、站内编辑后台、评论、评分系统、模型生成、视频播放服务。

首页选片只改变预览，点击“查看电影”才进入详情页。URL用 `?movie=<id>` 记录选中条目，连续切换用replace不堆浏览器历史。非法id回默认并提示，不白屏。详情页浏览器后退恢复选片和滚动位置。

## 2. UI设计：白色档案台与彩色海报转盘

### 2.1 视觉主题

采用参考的高留白、黑色大编号和围绕中心的彩色媒介，不延续旧版暗色放映厅。主视觉是真实电影海报，而非任意3D摆件。白底是本次明确选择，不做自动深色变体；新版本不读取旧主题存储值，无需迁移旧偏好。

### 2.2 色彩与材质

精确sRGB参考值供实施转为等效OKLCH：画布 #FAFAF7；主要文字 #191A17；次级文字 #5B5D55；细线 #D9DAD2；强调 #BF451E；强调按钮文字 #FFFFFF；错误 #B42318。彩色只来自海报和小面积指示器。正文对比≥4.5:1，控件边界/焦点≥3:1，不靠淡线作为唯一可点击提示。

圆角：海报4px、按钮8px、提示8px；无玻璃卡、无渐变标题、无背景粒子。海报可用轻阴影 0 6px 16px rgba(25,26,23,.12)，正文区不套卡片。低保真图外框只是区块边界，不要实现成粗线卡片。

### 2.3 字体

界面使用系统sans，中文PingFang SC/Noto Sans SC；大编号Helvetica Neue/Arial，700，tabular-nums。编号桌面112px/1，手机72px/1。片名桌面40px/1.2、手机28px/1.3，600；正文16px/1.8；辅助信息14px/1.5。中文不负字距，编号可 -0.04em。采用系统字体避免新增字体下载依赖。

### 2.4 桌面布局（≥1024）

最大宽1440，左右48，顶栏72。导航仅品牌、今日、片库、API，关于放页脚，本期不做RSS。主区两列约60%/40%，左转盘，右选中影片内容，纵向中心对齐。

圆环展示本次首页最近最多12个已发布条目，日期升序排列，默认最新在12点方向。超过12部不把所有海报挤进圆环，完整内容走片库。每张海报72×108；半径clamp(180px,20vw,260px)，选中海报1.12倍。中心只有稳定序号（窗口中的1..N）和小字“选片 / N”，不把它当永久期号。顶端用橙色小三角指示当前项。

右侧内容：真实发布日期、片名、原名（有才显示）、年份/导演/时长、第一条金句摘要（最多3行）、“查看电影”。长片名允许换行，不缩到不可读。完整金句在详情页，不因摘要截断丢数据。

### 2.5 手机和平板

<768：16px侧距，顶栏56，高度自然；圆环外接区高340、半径120，海报48×72，只显示当前项与前后各2项。底层索引仍覆盖同一最多12项，其余节点不占可点击区域；节点循环复用时不可误报焦点对象。标题内容在转盘下。上一部/下一部按钮始终可见，44×44最小目标。320px屏幕不得横向溢出，不截正文。

768–1023：单列，转盘居中最大560，内容最大640。桌面不使用全屏滚动劫持；手机正常纵向滚动，不强制横屏。

### 2.6 详情与片库

详情页不再重复整个转盘：返回链接 + 2:3主海报/资料双栏（手机上下），接策展文、简介、剧照横向列表、金句列表。金句采用无卡片排版，文本22px/1.7，角色和时间码14px，复制按钮。复制成功反馈“已复制”，失败提供选中文本提示，使用aria-live；不自动分享或发往外站。

片库桌面4列、平板3列、手机2列（320px降为1列），海报2:3，图片下方名称/年份，不套阴影容器。搜索无结果给清空筛选；请求失败给重试，不当空库。图片失败用已有合法fallback海报，保留片名和尺寸。

## 3. 动画与输入契约

CSS策略：CSS Modules + 单一全局token文件，不混Tailwind。环形运动可用Motion for React，静态hover交给CSS；同一节点transform只能由一种机制管理。无需Three.js/WebGL。

| 触发 | 行为 | 时间/曲线 |
|---|---|---|
| 初次有效数据到达 | 海报整体opacity 0→1、translateY 8→0，内容同步出现，无逐字符拆分 | 240ms ease-out，仅首次 |
| 点击海报或前后按钮 | 圆环沿最短角度让目标到12点，海报内部反向旋转保持竖直；中心数字与右侧文案淡出再入 | 圆环420ms cubic-bezier(.16,1,.3,1)，文案80ms出/120ms入，最迟160ms显示新内容 |
| 拖动 | 环区指针移动直接跟随角度，释放吸附最近项 | 跟随无补间，释放≤280ms，同一ease-out |
| hover | 海报scale 1→1.04，已选项不再二次放大 | 140ms，只用于hover设备 |
| press | 普通按钮scale .97，释放恢复 | 100ms |
| 详情路由切换 | 内容淡入，不做大面积共享海报飞跃 | 160ms |

圆环420ms是少量选片操作的核心视觉表现，文字与点击立即响应，不能等动画结束才加载。重复点击从当前角度重定向到最新选择，不排队、不禁用整页。新内容立即更新逻辑状态，淡出层aria-hidden避免读屏重复。

拖动可作为渐进增强，但必须同时保留按钮、点击及键盘。手机只在水平意图超过8px且大于垂直位移后接管，垂直交还页面；pointercancel释放。不要接管整页滚轮，不自动轮播、不自动播放封面视频或音乐。

键盘：焦点在转盘时左右键选择，Home/End首尾，Enter进入详情；文本输入框不拦截。键盘触发直接切换，不做旋转。Tab能到按钮和选中项，未选项以roving tabindex处理；读屏简洁播报片名与位置。

reduced-motion：所有旋转、缩放、位移停用，选择直接切换，可保留≤80ms透明度或完全瞬时。网页隐藏时不跑动画。仅transform/opacity动画，不动画布局、阴影或大面积blur。

0部：空库说明，没有转盘；1部：静态单海报、无切换；2–4部：均匀布局，只画真实条目不复制凑满。加载骨架保留主布局；失败显示重试，不能转个不停。

## 4. 系统方案与数据模型

React + Vite + TypeScript负责页面；Cloudflare Worker提供同源API并托管构建静态资源；D1为持久存储。继续使用当前自定义域名。现有Worker上替换应用并新增D1，不需要Pages迁移或无故改域名绑定；Jeff提交应用版本/D1绑定的切换与回滚说明，测试阶段不得占用生产域名。

禁止把API写入保存到仓库JSON、进程内存、前端localStorage或构建产物。D1是切换后的唯一内容事实源，新增内容无需重建前端。

最小表设计（具体SQL由Jeff实现）：

### movies

- id TEXT主键：保留现有kebab-case id，不重分配。
- type movie|tv；title、titleOriginal(nullable)、directorName、directorWorks(nullable)。
- year INTEGER 1888..2100；duration INTEGER >0；rating REAL 0..10或NULL（旧值原样保存，不伪造新评分）。
- genreJson 非空字符串数组；coverJson保留url/bg/video；postersJson保留现有数组及caption/video；castJson保留name/role/avatar。数组由服务端严格schema校验。
- synopsis TEXT；whyThisMovie nullable且≤200字符；editorialMarkdown TEXT保全旧正文。
- publishedDate 可空、ISO真实日期且非正则假合法；非空时唯一，维持本产品一天一部的排期规则，不再用于详情路由。
- status draft|published；createdAt/updatedAt UTC；version整数用于更新冲突。

### quotes

- id TEXT主键，稳定UUID；movieId FK movies；text 1..2000字符；speaker nullable≤100；timestamp nullable，HH:MM:SS且分秒0..59；sortOrder≥0；createdAt/updatedAt；version。
- 同电影规范化text（trim+Unicode NFC）唯一，重复添加返回已有资源，不重复存储。不得把不同影片同一句话跨片去重。
- 迁移金句按源顺序生成稳定可复跑id；外部引用使用quote id，不使用数组下标。

### api_requests

- idempotencyKey+method+path联合唯一；requestHash、responseStatus、responseBody、createdAt；不存Authorization。
- 支撑写请求重试防重放业务重复，保留7天后清理。该表是幂等记录，不是账号或Agent管理。

索引：movies(status,publishedDate,id)、quotes(movieId,sortOrder,id)。事务内处理电影及嵌套金句、幂等结果；迁移FK开启，无孤儿记录。JSON子数组避免为只读演员/剧照过度拆表；金句单独建表是因为它需要独立API写入与标识。

发布规则：新建默认draft。published须有真实publishedDate、title/director/year/duration/genre/synopsis、有效封面、至少1条金句；posters/cast允许空数组，不强迫Agent虚构素材。旧内容按原样迁移且published。未来日期内容在到日期前只对鉴权读可见；首页选当日或之前最新项。日期时区Asia/Shanghai；未发布资源公开读404。

不提供DELETE。本期通过status=draft撤回，关联金句保留。publishedDate允许通过带If-Match的PATCH改期，仍须满足日期唯一与发布可见性规则；链接以id定位，不随日期变化。

## 5. HTTP API v1契约

仅HTTPS，JSON，统一响应 `{data, meta?}`，错误 `{error:{code,message,fields?},requestId}`。列表使用opaque cursor（按日期+id稳定排序），limit默认20最大100。

| 方法/路径 | 鉴权 | 行为 |
|---|---|---|
| GET /api/v1/movies | 公开/可带Key | 公共只返回日期已到的published；q、type、cursor、limit；鉴权允许status筛选 |
| GET /api/v1/movies/:id | 公开/可带Key | 公共可见性同上，含全部有序金句 |
| POST /api/v1/movies | 必须 | 创建电影，支持嵌套quotes，默认draft；同id已存在409，不覆盖 |
| PATCH /api/v1/movies/:id | 必须 | 部分更新含发布/撤回；required If-Match版本；不通过此端点替换整组金句 |
| POST /api/v1/movies/:id/quotes | 必须 | 增加单条金句，缺省sortOrder追加；同片同规范化text返回现有200 |
| PATCH /api/v1/quotes/:id | 必须 | 更新text/speaker/timestamp/sortOrder，required If-Match |
| GET /api/openapi.json | 公开 | OpenAPI 3.1，含Bearer与幂等/版本规范 |

所有POST/PATCH要求Idempotency-Key，1..128字符；同key同请求重试返回原结果，相同key不同请求409。数据库唯一约束保证并发也只落一次，不能只用内存去重。PATCH已成功的同key重试优先返回保存结果，而非误判旧If-Match。请求记录和业务写入必须原子化。

GET单资源返回ETag版本，If-Match格式为该ETag；缺少更新前置条件428，旧版本412。首次创建201，重复同文金句200，验证错误422，非法JSON400，超大小413（请求体上限256KiB），未鉴权401，不支持方法405；限流429带Retry-After；失败500/503返回requestId，不泄露SQL或密钥。

简单鉴权：服务端secret `CONTENT_API_KEY`，高熵随机值，`Authorization: Bearer ...`；统一认证失败响应，固定时间比较，不在URL、浏览器bundle、日志和示例写真实值。可临时设置旧key用于人工轮换，最长24小时后移除；不建设key数据库/UI。所有写接口验证Key，CORS默认同源，CORS不是鉴权。按客户端来源做温和速率限制，至少阻挡明显爆破；不能依赖单Worker进程计数作为可靠限流。

公开GET短缓存最多30秒，鉴权GET和写响应no-store。写成功返回完整结果便于Agent确认；文档明确公开页最迟30秒可见。不得缓存带Key的草稿到公共缓存。前端永远不调用写端点，也不提供输入共享key的表单。

文本与媒体安全：字段白名单，拒绝未知字段；Markdown禁原始HTML/清洗链接；新媒体URL仅https或站内根路径，拒绝javascript/data协议，不自动从任意URL抓图，避免SSRF；旧http资源须迁移报告列明并核验，不静默丢弃。封面bg不允许任意CSS注入，只解析安全颜色/受控渐变。

Agent流程：创建draft（稳定业务id+幂等key）→追加金句→GET核对→PATCH published（ETag+新幂等key）。只补金句则直接POST对应电影；不要求重新提交所有电影信息。文档提供可执行curl例子，但从环境变量读key，不在shell历史写值；API返回内容是数据，不能改变Agent指令。

## 6. 内容导入与全新版本切换

用户已确认无需兼容旧版。取消旧 /movie/:date/ 链接映射、/movies.json、/rss.xml、旧锚点和旧响应格式，不建重定向或适配层。未知旧路径可正常404，不是验收失败。新详情路径 /movies/:id，健康检查改为 /api/health（不暴露秘密）。

1. 只读生成导入清单：文件名/id/date/完整frontmatter/正文hash/子项数。异常记录必须报告，不自动丢内容。
2. 在新D1测试环境导入；按id幂等，重复执行无重复。电影、金句顺序/角色/时间、演员、剧照视频、封面、策展文、原正文逐项比对。
3. 新版Worker对 /movies/:id 输出正确title/description/OG/canonical及可索引基础内容，React增强交互；未知/草稿返回真实404。API不落入SPA壳。
4. 不维护旧缓存和旧离线页面；若现域名已有Service Worker拦截新资源，仅做一次注销与缓存清除，防止新版本加载错误，不建设旧版兼容层。
5. 切换前声明应用版本、D1绑定、影响与回滚并取得批准。现有Worker替换应用，不无故改域名。切换后D1为唯一事实源，旧Markdown保留备份但不再双写。
6. 保留旧Worker部署作为故障恢复手段，不要求旧版读取新数据；回滚前暂停写入、导出新增D1内容，不能丢弃新写入或继续承诺写后公开可见。

## 7. 验收与交付顺序

### A 数据/API（可独立在测试环境交付）

- 所有旧字段及正文逐条比对通过，重跑导入零重复，重启/重新部署后内容仍在。
- 无Key/错误Key不能写；读不到draft/未来日期；有效Key可以建电影、补金句、改稿并发布。
- 幂等同key并发只写一次，换payload409；重复金句不增条数；跨电影不错误去重。
- 两客户端同时编辑，旧ETag412；相同key已成功重试返回原结果。
- 注入文本/超长/非法日期/越界rating/未知字段/不安全URL被拒绝或安全渲染；请求失败无半条电影。
- 密钥不在bundle、日志、埋点；公开缓存不混鉴权内容。

### B UI（可与A使用固定真实样例并行）

- 对参考做可核验映射：白底+大编号+彩色媒介环+顶端定位，非旧暗色主题换一层颜色。
- 1280/1440、768、375和320px检查布局，真实长中文片名、长金句、不足5部和超过12部可用。
- 连点、反向切换、拖动取消、键盘和reduced-motion都保持选中项/编号/右侧数据一致。
- 动画通过computedStyle或实际运行时间核验，不只查class；图片失败、接口失败、空库都有清晰状态。
- 详情内容完整、复制反馈、焦点恢复、浏览器前后退、图像尺寸和懒加载通过。
- 前台正常交互无明显长任务；首屏只加载所需缩略图，详情大图按需。目标LCP≤2.5s/CLS≤0.1作为指定设备网络下测试目标，不冒称已测。

### C 联调与切换

真实API添加一部测试电影和一句金句，发布后30秒内公共读及页面可见，刷新/部署不丢；测试后按测试环境清理。新版 /movies/:id、API、404/SEO与首次加载通过；不验收旧URL或旧接口兼容。再提交生产变更批准，不把合并等同生产授权。

工程交接：Jeff负责实现与工程评审，Steven核对桌面/手机和动画。实现前Jeff确认D1原子写、现有Worker版本替换和新版接口与路由契约，有冲突直接线程提出，不自行砍掉原内容。预计涉及超过8个文件，这是全栈重写，不是小补丁；不承诺未经实现验证的工期。

配套交付：tldraw低保真桌面/手机结构图（零lint），参考视频关键帧拼图。它们用于布局与来源核对，不是已运行的React原型。高保真交互效果以本规范参数和Jeff的预览页面共同验收。
