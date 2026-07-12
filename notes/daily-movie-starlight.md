# daily-movie 星夜色 · Starlight Theme Spec v1.1

> 频道：#proj-daily-movie task #34
> 日期：2026-07-12（v1.1 修订：纠正现状描述、加入字体性能与缓存细节）
> 参考图：Victor 提供的深蓝夜空 + 远天际暖光带 + 开阔平原（IMG_9198.jpeg）
> 流程：设计 spec → 工程复核 → 实施 PR → CR → 合并（具体执行者由 Slock task board 决定，不在此固化）

## 修订记录

- **v1** (2026-07-12 evening): 初稿。误将现状描述为"像素风"（该状态已在 PR #16/#20 后 revert）。
- **v1.1** (2026-07-12 late-evening): 按 @Martin CR 修订：
  - §1 §6 修正现状为 Anthropic Amber Theme
  - §8 移除不存在的清理项（scanlines / pixel-* 类）
  - §8 增补：字体权重收缩 + preload 策略、manifest theme_color 同步、sw.js cache-bust
  - §9 补充兼容性 baseline 说明

---

## 0. 与其他 token 系统的边界

本 spec 只覆盖 daily-movie 项目的视觉系统 v1，与以下系统**完全隔离**：

| 系统 | 主色 | 边界 |
|---|---|---|
| daily-movie starlight (本 spec) | 深空蓝 #0B1220 + 星月冷蓝 #9CB3D9 + 枯草暖 #C8855A | 只用于 daily-movie |
| gomate Design System v2.0 | 琥珀 #D97706 + 沙米 #FAF8F5 | 只用于 gomate |
| Victor 推特 IP v0.2 | 近黑 #0A0A0A + 科技蓝 #3B82F6 | 只用于 X 配图 |

**混用 = 品牌崩坏**，不允许跨系统借 token。

---

## 1. 设计意图

**关键词**：星夜 · 秋夜 · 冷风 · 枯草 · 安静 · 电影感

**现状 → 目标**：
- 现状：Anthropic Amber Theme（light 米色 #F5F4EF + 琥珀 #D4A800；dark 炭黑 #1A1A1A + 金 #F5C518），双主题、系统字体栈、明亮商业感
- 目标：夜空深邃、安静低对比、微光聚焦、走进夜里空荡的放映厅

**核心张力（决策 C）**：
整页冷色环境，电影封面经过 CSS `filter: saturate(0.7)` 处理后作为**唯一暖色焦点**。呼应参考图里天际线那一束微光——冷寂里唯一有温度的东西是电影本身。

---

## 2. Color Token

### 2.1 背景层（冷蓝空间）

| Token | Hex | 用途 |
|---|---|---|
| `--bg-primary` | `#0B1220` | 主背景，深空蓝（比现状 #0d0b1a 更蓝更冷） |
| `--bg-secondary` | `#142033` | 次级背景（区块底） |
| `--bg-card` | `#172238` | 卡片底 |
| `--bg-overlay` | `rgba(11, 18, 32, 0.88)` | 模态遮罩 |
| `--bg-cinema` | `#070B14` | 详情页封面底（最深，封面像漂浮夜空） |

### 2.2 文本

| Token | Hex | 用途 |
|---|---|---|
| `--text-primary` | `#E6ECF5` | 正文（冷白，非纯白） |
| `--text-secondary` | `#A8B3C5` | 次级文字 |
| `--text-muted` | `#6C7A92` | 元信息 |
| `--text-bright` | `#FFFFFF` | 极强对比（谨慎使用） |

### 2.3 冷色强调（星月光）

| Token | Hex | 用途 | 替代 |
|---|---|---|---|
| `--accent` | `#9CB3D9` | 主强调、链接、CTA 背景 | 原 amber `#D4A800` / dark `#F5C518` |
| `--accent-hover` | `#B8CCE6` | 悬停 | 原 `#B89200` / `#FFD54F` |
| `--accent-soft` | `rgba(156, 179, 217, 0.12)` | 弱底 | |

**决策理由**：Anthropic 商业金 / 暖琥珀是明亮温暖气质，与「星夜安静影院」直接矛盾。改为冷星月蓝，降低亮度和饱和度。

### 2.4 暖色焦点（枯草暖）

| Token | Hex | 用途 |
|---|---|---|
| `--ember` | `#C8855A` | 封面残留暖色、引用强调、封面光晕 |
| `--ember-hover` | `#D89B72` | 悬停 |
| `--ember-soft` | `rgba(200, 133, 90, 0.12)` | 弱底 |

**决策理由**：ember 是整页唯一暖色，出现次数极少（3-4 处/页），控制稀缺性 = 焦点效应。

### 2.5 状态色（脱饱和）

| Token | Hex | 用途 |
|---|---|---|
| `--success` | `#7A9B7E` | 灰绿 |
| `--warning` | `#C8A368` | 暗琥珀 |
| `--danger` | `#B86A6A` | 暗砖红 |

### 2.6 边框与分割线

| Token | Hex | 用途 |
|---|---|---|
| `--border` | `#1F2C42` | 卡片边框 |
| `--border-bright` | `#2E3F5C` | 高亮边框 |
| `--divider` | `#1A2540` | 极细分割线 |

---

## 3. Typography

| 用途 | 字体栈 | 备注 |
|---|---|---|
| 正文中英文 | `"Inter", "Noto Sans SC", sans-serif` | 替换现状的系统 UI 字体栈 |
| 电影标题（中英） | `"Cormorant Garamond", "Source Han Serif SC", serif` | 衬线，呼应「安静放映厅」 |
| 标签/元信息 | `"JetBrains Mono", ui-monospace, monospace` | 现状已有，保留 |
| Logo | 同正文中英文 | 与整页字体系统统一 |

**决策理由**：从中性系统字体升级到指定的 Inter + Cormorant 衬线组合。系统字体虽稳但缺乏电影气质；衬线是"安静"最直接的字体语言。

### 3.1 字号阶梯（1200×1200 基准）

| 层级 | 字号 | 字重 | 用途 |
|---|---|---|---|
| 大标题 | 48px / 3rem | 500 | 首页 hero 标题 |
| H1 | 32px / 2rem | 500 | 详情页电影标题 |
| H2 | 24px / 1.5rem | 500 | 区块标题 |
| 正文 | 16px / 1rem | 400 | 大段文字，line-height 1.75 |
| Caption | 13px / 0.8125rem | 400 | 元信息、时间戳 |
| Meta | 11px / 0.6875rem | 500 letter-spacing 0.05em | 标签、chip |

---

## 4. Layout · 三屏设计意图

### 4.1 首页 `/`（列表 + 今日推荐）

```
┌──────────────────────────────────────────┐
│ [logo]           首页 电影库 搜索 归档  │
├──────────────────────────────────────────┤
│                                          │
│  「今日电影 · 2026-07-12」               │  ← 衬线大字 + accent
│                                          │
│  ┌──────────────────┐  推荐语 2 行       │
│  │  电影封面 (4:3)   │  在冷夜里，       │
│  │  saturate(.7)     │  你会想起哪部    │
│  │  ember 光晕       │  老片？          │
│  └──────────────────┘                    │
│                                          │
│  ── 往期电影 ──────────────────────      │  ← divider
│                                          │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐                │  ← 4 列（宽度略错落）
│  │封│  │封│  │封│  │封│                 │  移动 1 列，平板 2 列
│  └───┘ └───┘ └───┘ └───┘                │
│  标题     标题    标题    标题           │  ← 衬线小字
│  2026-07-11  ...                         │  ← muted
└──────────────────────────────────────────┘
```

**要点**：
1. Hero 左图右文，封面占 60% 宽（不满版），给文字呼吸——呼应参考图「开阔」
2. 封面加 `box-shadow: 0 0 32px rgba(200,133,90,0.25)` ember 微光晕
3. 网格 4 列宽度不均：232 / 228 / 240 / 224，模拟"散落"感

### 4.2 详情页 `/movie/[date]/`

```
┌──────────────────────────────────────────┐
│ [nav]                                    │
├──────────────────────────────────────────┤
│                                          │
│  ┌───────────────────────┐               │
│  │                       │               │
│  │  电影封面 (3:2 大图)  │  电影标题     │  ← 衬线 32px
│  │  saturate(.7)         │  导演/年份/时长│  ← muted
│  │  ember 光晕           │  ─────────    │
│  │                       │  ★ 8.7        │  ← 用星标不用数字
│  └───────────────────────┘               │
│                                          │
│  剧情标签                                │
│  ┌────┐ ┌────┐                          │  ← chip
│  │剧情│ │犯罪│                          │
│  └────┘ └────┘                          │
│                                          │
│  ── Synopsis ─────────────────           │
│  剧情简介正文。冷蓝正文 #E6ECF5，        │
│  行高 1.75。                             │
│                                          │
│  ── 经典台词 ─────────────────           │
│  " 我们在黑暗里相遇 "                    │  ← 衬线斜体
│                    —— 角色名             │  ← ember 引号
│                                          │
│  ── 导演 / 演员 ──────────────           │
│  网格卡片                                │
└──────────────────────────────────────────┘
```

**要点**：
1. 封面最大宽度 720px，左对齐，不铺满
2. 电影标题用 `--accent` 冷蓝（不用 ember，因为 ember 已经在封面光晕出现）
3. Quote 引号 `"` 用 `--ember` 着色 —— 整页第二处 ember
4. 评分用 ★ 图标 + 数字，Meta 字体

### 4.3 归档页 `/archive/`

```
┌──────────────────────────────────────────┐
│ [nav]                                    │
├──────────────────────────────────────────┤
│                                          │
│  「按月归档」                            │  ← 衬线大字
│                                          │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐         │  ← 5 列网格
│  │封 │ │封 │ │封 │ │封 │ │封 │         │  桌面 5，平板 3，手机 2
│  └───┘ └───┘ └───┘ └───┘ └───┘         │
│                                          │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐         │
│  │封 │ │封 │ │封 │ │封 │ │封 │         │
│  └───┘ └───┘ └───┘ └───┘ └───┘         │
│                                          │
│  ── 时间轴（横向滚动）─────────────────  │
│  2025-09  10  11  12  01  02  03  ...    │  ← Mono 字体
└──────────────────────────────────────────┘
```

**要点**：
1. 不做瀑布流，规则网格 = 冷静感
2. 月份导航横向时间轴用 Mono，光标停留月份 `--ember` 着色
3. 每张封面 hover 时增强 saturate 到 0.9（临时回归原色，暗示"点进去看电影"）

---

## 5. Motion 动效

**原则**：一切动效降到 200ms 以内，缓动用 `cubic-bezier(0.4, 0.0, 0.2, 1)`（无回弹）。

| 场景 | 动效 |
|---|---|
| 页面进入 | fadeIn 240ms |
| 封面 hover | saturate 0.7 → 0.9，box-shadow ember 强度 ×1.5，180ms |
| 卡片 hover | 无位移，仅背景色 `--bg-secondary` → `--bg-card` |
| 页面滚动 | 保持原生平滑滚动 |

---

## 6. 与现状 Anthropic Amber Theme 的差异总结

| 维度 | 现状 (Anthropic Amber) | Starlight |
|---|---|---|
| 主背景 (light) | #F5F4EF 米色 | — (light-mode 移除) |
| 主背景 (dark) | #1A1A1A 炭黑 | #0B1220 深空蓝 |
| 主强调 (light) | #D4A800 商业琥珀 | — |
| 主强调 (dark) | #F5C518 金 | #9CB3D9 冷星月蓝 |
| 次强调 | 无（单强调色） | #C8855A 枯草暖（唯一暖色焦点） |
| 字体标题 | 系统字体栈 | Cormorant Garamond 衬线 |
| 字体正文 | 系统字体栈 + Noto Sans SC | Inter + Noto Sans SC |
| 圆角 | 8/12/16 三档（保留） | 同（复用现状） |
| 主题模式 | Light + Dark 双主题 | Dark-only |
| 电影封面 | 原色 | `filter: saturate(0.7)` |
| 封面光晕 | 无 | `box-shadow` ember 微光晕 |
| Manifest theme_color | `#D4A800` | `#0B1220` 或 `#9CB3D9`（需与 CSS 同步） |

---

## 7. Dark/Light 模式

**决策：dark-only**。

理由：
- 电影是黑暗艺术形式，深色是本命底色
- 现状 light mode（液晶屏蓝灰 #c8d8e8）与「星夜」主题彻底冲突，保留会拉低品牌辨识度
- 减少维护成本

如果后续 Victor 明确要求补 light，再另开 v2。

---

## 8. 落地文件清单（工程实施参考）

预估工作量：**0.5 天**（不含 review）。

- [ ] 新建 `public/styles/starlight-theme.css`（新写，不复用 Anthropic Amber 结构，因 dark-only 简化）
- [ ] `src/layouts/Layout.astro`：
  - `<link rel="stylesheet">` 从 `anthropic-theme.css` 切到 `starlight-theme.css`
  - 移除 `[data-theme="dark"]` / `[data-theme="light"]` 切换逻辑（如有）
- [ ] 字体加载（性能敏感）：
  - `@import` 引入 Inter (400/500) + Cormorant Garamond (400/500) + Noto Sans SC (400) + JetBrains Mono (400)
  - 全部 `font-display: swap`
  - 只 preload Inter 400（首屏主字体）
  - 减少子集加载：Noto Sans SC 用 subset 或 CDN 分片
- [ ] 电影封面 CSS：
  - 所有 `<img>` 电影封面加 `.movie-cover` 类
  - CSS：`.movie-cover { filter: saturate(0.7); transition: filter 180ms ease; }`
  - Hover：`.movie-cover:hover { filter: saturate(0.9); }`
- [ ] 电影封面 ember 光晕：详情页大封面 + 首页 hero 封面加 `box-shadow: 0 0 32px rgba(200,133,90,0.25)`
- [ ] `public/manifest.webmanifest`：`theme_color` 从 `#D4A800` 改为 `#0B1220`（bg-primary）或 `#9CB3D9`（accent），需与浏览器地址栏效果决定
- [ ] `public/sw.js`：Service Worker 缓存 bump — 修改 CACHE_NAME 版本号，强制客户端刷新旧样式
- [ ] `favicon.svg` / `logo.svg`：需要新画（设计侧交付，spec 通过后单独出）
- [ ] （可选）`agents/daily-movie-writer.md` 里如有引用旧主题色，同步更新

---

## 9. Review Checkpoints（工程复核用）

- Token 语义清晰，无 token 复用 gomate / Twitter IP
- Dark-only 决策合理（如需 light 单独讨论）
- 字体加载性能可接受（4 个字体族，`font-display: swap` + preload 只针对 Inter 400）
- `saturate(0.7)` 兼容性 OK（Safari 6+ / Chrome 18+ / Firefox 34+，daily-movie 在 Cloudflare Pages 上，浏览器 baseline 已排除 IE）
- 移动端 3 列/2 列自适应正确
- `manifest.webmanifest` `theme_color` 与 CSS 同步（`#0B1220` 或 `#9CB3D9`）
- `sw.js` cache-bust 已 bump 版本号
- 无 legacy 类残留（现状已无 `.pixel-*` / `.scanlines` / `neon-*`，无需清理）

---

## 10. 下一步

1. 本 spec 送工程侧复核（可行性、边界、拆分粒度）
2. 由 Slock task board 分配实施与 CR
3. 设计侧另出新 logo + favicon（spec 定稿后单独交付）
4. Victor 终批

---

_spec 版本 v1，接受修订。任何 token 具体色值可微调，但结构（3 色系 + 衬线标题 + saturate 决策 C）建议保留。_
