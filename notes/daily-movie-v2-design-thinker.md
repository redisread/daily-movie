# daily-movie v2 · 「放映厅」Design Spec v1

> 任务：#35 daily-movie UI/UX 深度重构（方案 A：推翻 starlight v1.1）
> 频道：#proj-daily-movie
> 设计者：@Steven
> 日期：2026-07-12
> 版本：v1（v0.5 思考草稿已并入本文）

---

## 0. 设计哲学（设计前的设计）

### daily-movie 是什么

**不是**电影推荐网站。**是**每天发生一次的放映仪式。

用户行为：每天 1 次，每次 30 秒，被电影「选中」而不是「搜索」。

### 设计核心隐喻

> 推开放映厅的门 → 坐下 → 灯关了 → 银幕亮了

这个隐喻贯穿所有页面、组件、动效。

### Jobs 方法论应用

1. **砍掉所有「好」的功能，只留「必须」**（详见 §3 清单）
2. **每个像素问「为什么」**—— 不留无意义元素
3. **把技术藏起来**—— 用户看到的是「放映厅」，不是「网站」
4. **端到端体验**—— 从打开到关闭，每一帧都有理由

---

## 1. 视觉系统

### 1.1 Color（3 色）

| Token | Hex | 用途 |
|---|---|---|
| `--paper` | `#F5F1E8` | 奶白米（**主背景**，所有页面默认底色） |
| `--ink` | `#0A0A0A` | 墨黑（**文字 + 细线 + 暗色反转区域**） |
| `--gold` | `#B8985A` | 枯金（**唯一 accent**：台词引号、关键数字） |

**没有渐变**。**没有阴影**。**没有 box-shadow**。**没有背景图**。

> 修正（v1.1）：原 §1.1 文字与 §2 wireframes 矛盾——文字写「ink 是背景」，但 wireframe 显然 paper 是背景。**正确**：paper 是主背景，ink 是文字 / 细线 / 反转。

### 1.2 Typography（单字体家族 — Latin + CJK）

```
Latin: Cormorant Garamond（衬线）
  - 正文：400
  - 标题：500
  - 副文：italic 400
  - 数字：500 tabular

CJK:  Noto Serif SC（衬线，作 Latin 字体家族的中文兄弟）
  - 同样 400 / 500 / italic 400
```

**视觉上视为「一个衬线家族」**——不是「单字体文件」。两者的衬线粗细、字面、气质对齐，页面看上去像单字体。

> 修正（v1.1）：原 §1.2 写「单字体」太绝对。Cormorant 不支持中文，砍 Noto Sans SC 会导致中文 fallback 到系统字体不一致。**正确做法**：Cormorant (Latin) + Noto Serif SC (CJK) 作为单一衬线家族，self-host。

### 1.3 Spacing（极端留白）

- 上下 padding：≥ 15vh
- 左右 padding：≥ 8vw
- 行间距：1.8
- letter-spacing：-0.02em
- 内容占屏：≤ 50%

### 1.4 Hierarchy（仅用尺寸 + 字重 + 位置）

| 层级 | 字号 | 字重 | 位置 |
|---|---|---|---|
| 电影标题（hero） | 48-72px | 500 | 居中 |
| 电影标题（详情） | 96px | 500 | 居中 |
| 副标题（导演/年份）| 14px | 400 italic | 居中 |
| 日期标签 | 12px | 500 uppercase | 居中 letter-spacing 0.1em |
| 台词 | 18px | 400 italic | 居中 |
| 简介正文 | 18px | 400 | 居左或居中 |
| 类型 / 时长 | 11px | 400 uppercase | 居中 letter-spacing 0.1em |
| Footer 文字 | 10px | 400 uppercase | 居中 letter-spacing 0.2em |

**所有文字只有黑与白两个颜色**。层级靠**尺寸 + 字重 + italic + 位置**。

---

## 2. 关键页面 Wireframe

### 2.1 首页 `/`

```
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│                                          │
│         「 今 日 影 片 」                  │  ← 小字 italic，居中
│         TUESDAY, JULY 12                 │  ← uppercase
│                                          │
│                                          │
│                                          │
│              《 肖 申 克 的                              │  ← 主标题 72px / 500
│                救 赎 》                              │  居中，字符间留白
│                                          │
│              Frank Darabont · 1994       │  ← 副标题 italic
│                                          │
│                                          │
│                                          │
│                  ┌──────┐                 │
│                  │      │                 │
│                  │ 封面 │                 │  ← 单图，最大 480×680
│                  │      │                 │  无边框，无阴影
│                  └──────┘                 │
│                                          │
│                                          │
│         「 希望让人自由。」               │  ← 台词 italic，金色引号
│                                          │
│                                          │
│                                          │
│  ← 第 1 部 / 第 5,400 部 / 第 5,402 部 →  │  ← 上下篇导航
│                                          │
│                                          │
│                              ▽ DETAIL    │  ← 入口（下划线 hover 展开）
│                                          │
└──────────────────────────────────────────┘
```

**视觉重点**：
- 没有 nav、没有 logo、没有 footer
- 顶部留白 = 银幕高度
- 居中布局，所有元素垂直对齐中心线
- 「▽ DETAIL」是发现的，不是按钮

### 2.2 详情页 `/movie/[date]/`

```
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│                  《 肖 申 克 的                              │  ← 大字 96px
│                    救 赎 》                              │
│                                          │
│                  Frank Darabont · 1994                   │
│                                          │
│                  ─────────────                          │  ← 细线分隔
│                                          │
│                                          │
│         在二十世纪四十年代末，              │  ← 简介正文 18px / 1.8 行距
│         年轻银行家安迪被冤枉杀害            │
│         妻子和她的情人，被判无期徒刑，      │
│         在肖申克监狱度过余生……             │
│                                          │
│                                          │
│         ───                              │
│                                          │
│         「 希望让人自由。 」               │  ← 台词，金色引号
│                                          │
│                                          │
│         ───                              │
│                                          │
│         类型                              │
│         剧情 · 犯罪                       │  ← 次要信息
│         时长                              │
│         142 分钟                          │
│                                          │
│                                          │
│                                          │
│                              ← BACK       │  ← 返回首页
│                                          │
└──────────────────────────────────────────┘
```

**视觉重点**：
- 详情页和首页的区别：**深度 vs 仪式**
- 没有「分享」「收藏」「点赞」按钮
- 类型/时长在最底部，作为「顺便知道」

### 2.3 时间轴 `/archive/`

```
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│              ALL FILMS                    │  ← 衬线大字
│              自 2025 年起                 │  ← italic 副标题
│                                          │
│                                          │
│         2026                             │  ← 年份 italic
│                                          │
│         JUL                              │  ← 月份 uppercase
│         ───                              │
│         12  《肖申克的救赎》             │  ← 单行，标题 italic
│         11  《教父》                     │
│         10  《霸王别姬》                 │
│         09  《阿甘正传》                 │
│                                          │
│         JUN                              │
│         ───                              │
│         ...                              │
│                                          │
└──────────────────────────────────────────┘
```

**视觉重点**：
- 不是 grid，是单列时间线
- 没有缩略图
- 每行只有「日期 + 标题」
- 点击回放当日首页（回放仪式）

### 2.4 关于页 `/about/`

```
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│              ABOUT                       │
│              每日一部电影                  │
│                                          │
│                                          │
│         daily-movie 是一个每天推荐         │  ← 简短 2-3 段
│         一部经典电影的小项目。              │
│         不评分，不社交，不解释。           │
│         只是每天遇见一部。                │
│                                          │
│                                          │
│                                          │
│                              ← BACK       │
│                                          │
└──────────────────────────────────────────┘
```

**视觉重点**：极简 3 段。不超过 100 字。

---

## 3. 改造清单（删/改/留）

### 3.1 删除清单（v1.1 → v2）

| 元素 | 位置 | 理由 |
|---|---|---|
| 海报画廊 | `PosterGallery.astro` | 砍 |
| WhyThisMovie | `WhyThisMovie.astro` | 砍 |
| 演员列表 | `CastList.astro` | 砍 |
| 导演其他作品 | `DirectorCard.astro` | 砍 |
| /library 页面 | `pages/library/index.astro` | 砍 |
| /search 页面 | `pages/search/index.astro` | 砍 |
| nav 栏 | `Layout.astro` | 砍 |
| 主题切换 | `Layout.astro` | 砍（dark-only）|
| 「评分」展示 | 详情页 | 砍 |
| 类型 chip | 详情页 | 改文字 |
| 收藏 / 分享按钮 | 详情页 | 砍 |
| emoji nav 图标 | `Layout.astro` | 砍（用纯文字） |
| 路线指标三栏 | gomate 残留概念 | 砍（gomate 概念） |
| ember 光晕 | v1.1 视觉 | 砍 |
| 季节胶囊 | 封面右 | 砍 |
| 视频预览（如有） | 详情页 | 砍 |

**总计：~16 个元素砍掉**。

### 3.2 改造清单

| v1.1 元素 | v2 改造 |
|---|---|
| Hero（封面 + 推荐语 4 列 grid） | 单屏仪式（封面 + 标题 + 台词） |
| 4 列卡片网格（archive） | 单列时间线 |
| Inter + Cormorant + JetBrains Mono + Noto SC | 单字体 Cormorant |
| 暮色蓝 #0B1220 | 墨黑 #0A0A0A |
| 字体 + 强调色分层 | 仅尺寸 + 字重分层 |
| Light/Dark 双主题 | Dark-only |
| Manifest theme_color `#0B1220` | `#0A0A0A` |
| emoji nav | 无图标，纯文字 |
| Google Fonts CDN | self-host Cormorant Garamond |
| 200ms 直线缓动 | 3 秒进场仪式序列 |

### 3.3 保留清单

| 元素 | 保留理由 |
|---|---|
| `/movie/[date]` 路由 | 核心数据模型 |
| RSS / JSON API | 极简主义者也订阅 RSS |
| sw.js 离线 | 离线仪式 = 高级体验 |
| favicon / logo | 仪式感起点 |
| 缓存策略 | 翻页仪式需要即时响应 |
| 字体 + 字号 + 行距基础结构 | 性能 baseline |

---

## 4. 动效（3 秒进场仪式）

### 4.1 进场序列（首页）

| 元素 | 延迟 | 时长 | 缓动 |
|---|---|---|---|
| 背景色 fade-in | 0ms | 400ms | linear |
| 「今日影片」 | 200ms | 600ms | ease-out |
| 日期 | 300ms | 600ms | ease-out |
| 主标题（电影名）| 500ms | 800ms | ease-out |
| 副标题 | 700ms | 600ms | ease-out |
| 封面（从模糊到清晰）| 900ms | 1200ms | ease-out |
| 台词 | 1500ms | 600ms | ease-out |
| 上下篇导航 | 1800ms | 600ms | ease-out |
| DETAIL 入口 | 2100ms | 600ms | ease-out |

总时长 ~3 秒。**用户每天只来一次，这个节奏值得**。

### 4.2 翻页（上一部 / 下一部）

- 当前页 fade-out 400ms
- 新页 fade-in 400ms（**不做 slide**，仪式不需要）

### 4.3 Hover 反馈（仅 1 处）

`▽ DETAIL` 的下划线：默认无；hover 从 0 宽度展开到 100%（200ms ease-out）。

**其他所有元素**：hover 不变。这是规范。

### 4.4 禁用清单

- ❌ 字号 hover 放大
- ❌ 颜色 hover 变色
- ❌ 形状 hover 变形
- ❌ springScale 弹性
- ❌ scanlines CRT 效果（v1.0 像素风残留）
- ❌ box-shadow 任何地方

---

## 5. 字体加载策略

不用 Google Fonts。

### 5.1 字体文件

1. self-host Cormorant Garamond（latin + latin-ext subset），woff2，~30kb
2. self-host Noto Serif SC（中文常用字符 subset），woff2，~80kb
3. 两字体合计 ~110kb，预加载后用户感知 < 200ms

### 5.2 渲染策略

1. `font-display: block`（等字体加载完才渲染，确保仪式感一致）
2. preload 两个字体文件 + 关键 weight（400）
3. 其他 weight 用 `unicode-range` 增量加载
4. `font-size-adjust` 锁定行高，避免 FOUT

### 5.3 加载失败降级（v1.1 新增）

如果字体加载超过 1.5s（slow network），显示「放映厅准备中...」斜体提示，超过 3s fallback 到系统衬线（Songti SC / Georgia），避免用户感知为页面挂了。

> 修正（v1.1）：原 §4.1 + §5 没考虑加载慢场景。3 秒进场仪式 + block 渲染如果遇到慢网络 = 用户感知 6-8 秒空白。**正确做法**：preload + 降级提示。

---

## 6. 落地清单（工程实施参考）

预估工作量：**3-5 天**。

- [ ] 字体本地化：下载 Cormorant Garamond + Noto Serif SC subset → `public/fonts/`
- [ ] `Layout.astro`：删除 nav、删除 theme toggle、删除大量 class
- [ ] `index.astro`：重写为单屏仪式结构（参考 §2.1）
- [ ] `pages/movie/[date].astro`：重写为深度仪式结构（参考 §2.2）
- [ ] `pages/archive/index.astro`：替代 library/search，单列时间线（参考 §2.3）
- [ ] `pages/about.astro`：新建极简 3 段关于页（参考 §2.4）
- [ ] 删除：`PosterGallery.astro` `WhyThisMovie.astro` `CastList.astro` `DirectorCard.astro`
- [ ] 删除：`pages/library/index.astro` `pages/search/index.astro`
- [ ] 迁移：被砍页面加 `<link rel="canonical" href="/">` + 自定义 404 页面指向首页（避免 SEO 404）
- [ ] 删除：nav 中 emoji
- [ ] 删除：评分、chip、收藏 / 分享按钮
- [ ] 动效：CSS @keyframes 实现 §4.1 进场序列
- [ ] 加载失败降级：§5.3 「放映厅准备中...」fallback
- [ ] `manifest.webmanifest`：theme_color 改 `#0A0A0A`
- [ ] `sw.js`：CACHE_NAME 改名 `daily-movie-v2`，强制刷新
- [ ] favicon / logo：单独交付（设计侧）
- [ ] font-size-adjust：避免 FOUT 跳动

---

## 7. Review Checkpoints（工程复核用）

- 字体加载完成后再渲染（避免 FOUT）
- 不依赖任何 CDN（self-host）
- 进场动画总时长 ~3s（不延长到用户不耐烦）
- Dark-only 决策合理（如需 light 单独讨论）
- RSS / API 仍可访问
- 移动端单列布局正确
- `/movie/[date]` 路由 100% 兼容
- 删除的路由在 sw.js cache 中也要清掉

---

## 8. 我的设计选择解释（设计师视角给 Victor 的备注）

### 为什么砍这么多？

不是「功能多」就是好。**daily-movie 的产品价值 = 每天一次安静的相遇**，功能越少用户越能专注。Netflix 给你 10000 部让你焦虑，daily-movie 给你 1 部让你心安。

### 为什么单字体？

字体种类越多越「设计感」，但越不像电影。电影海报大多是单一字体。Apple 产品也是。Jobs 多次说「Less is more」。

### 为什么黑色背景？

不是「暗黑风」也不是「夜间」。是因为**电影本质是光在黑暗中出现**。白色背景 = 网页；黑色背景 = 银幕。

### 为什么 3 秒进场？

现代 web 追求「快」—— 这是错的。**有些内容应该慢**。用户每天只来一次，慢 3 秒建立仪式感是值得的。这跟 v1.1 的「200ms 动效」哲学完全相反。

### 为什么用「放映厅」隐喻？

因为 daily-movie 的产品定位 = 每天一次安静的相遇。「网站」隐喻让人想点开就走，「放映厅」隐喻让人想坐下来。

---

## 9. 下一步

1. Victor 走读本文档
2. 如需 mockup / 截图对比，由 @Steven 出（按需）
3. 合并 v1 进 daily-movie 仓库
4. 工程实施（新 PR，与 v1.1 PR #22 #23 完全独立）
5. 单独 favicon / logo 设计交付
6. Wen 回归测试

---

_spec v1。3 色 / 单字体 / Dark-only / 单屏仪式 / 砍 50% 功能 是设计底线。色值 / 字号具体值可微调。_