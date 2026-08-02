# 每日电影项目指南

## 项目概述

daily-movie 是一个静态站点，每天推荐一部经典电影。基于 Astro 6 + Zod 4 构建，部署到 Cloudflare Pages。

**线上地址**：https://daily-movie.jiahongw.com

## 技术栈

- **框架**: Astro 6.4
- **语言**: TypeScript
- **数据校验**: Zod 4
- **部署**: Cloudflare Pages（自定义域名 daily-movie.jiahongw.com）
- **测试**: Vitest（单测）+ Playwright（E2E）

## 目录结构

```
daily-movie/
├── src/
│   ├── components/     # Astro 组件（MovieCard / FeaturedCard / CastList / PosterGallery / QuoteCard / DirectorCard / WhyThisMovie / layout/* / ui/*）
│   ├── data/           # 电影数据（movies/*.md、movies.ts 加载器；movies.yaml 为迁移备份）
│   ├── layouts/        # 布局模板（Layout.astro）
│   ├── lib/            # 领域工具（history.ts）
│   ├── pages/          # 页面：index.astro / movie/[date].astro / 404.astro / health.json.ts / movies.json.ts / rss.xml.ts
│   └── schemas/        # Zod Schema（movie.ts、__tests__）
├── agents/             # 子 Agent 定义（daily-movie-writer.md）
├── public/             # 静态资源（styles、logo、favicon、fallback-poster、manifest 等）
├── tests/e2e/          # Playwright E2E（home.spec.ts）
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

## 常用命令

```bash
# 开发
npm run dev            # http://localhost:4321

# 构建
npm run build
npm run preview

# 代码质量
npm run lint
npm run typecheck      # astro check
npm run test           # Vitest 单测
npm run test:e2e       # Playwright E2E
npm run test:e2e:ui    # Playwright UI 模式
```

> 目前没有独立的 `validate:movies` 脚本。数据校验通过：
> 1. `src/data/movies.ts` 在构建时对每条做 `MovieSchema.parse()`（`npm run build` 或 `npm run dev` 会失败）
> 2. `npm run test` 中的 `src/schemas/__tests__/*.test.ts` 覆盖 Schema

## 添加电影

推荐使用子 Agent `agents/daily-movie-writer.md`（自动遵守 MovieSchema 约束）。

手动流程：
1. 在 `src/data/movies/` 新增一篇 `{id}.md`，使用 frontmatter 写入电影字段，正文写策展备注
2. 确保必填字段：`id / title / director / year / duration / genre / rating / cover / posters / cast / quotes / synopsis / publishedDate`
3. `quotes` 支持 3–10 条语录，全部会在单页详情中展示
4. 运行 `npm run build` 或 `npm run dev`——Zod 校验会在加载阶段失败给出报错
5. 运行 `npm run test` 校验 Schema
5. 提交并推送到 `main` 分支
6. Cloudflare Pages 自动构建部署

## 数据格式

```yaml
- id: kebab-case-id
  title: 中文标题
  titleOriginal: Original Title (可选)
  director:
    name: 导演姓名
    works: 代表作（可选）
  year: 1994
  duration: 142  # 分钟
  genre: ["剧情", "犯罪"]
  rating: 9.7
  cover:
    url: https://example.com/cover.jpg
    bg: 'linear-gradient(...)'
  posters:
    - url: https://example.com/poster1.jpg
      caption: 图片说明（可选）
  cast:
    - name: 演员姓名
      role: 角色名
      avatar: https://example.com/avatar.jpg (可选)
  quotes:
    - text: 经典台词
      speaker: 角色名（可选）
      timestamp: "01:23:45" (可选)
  synopsis: 剧情简介
  publishedDate: '2026-06-30'
```

## 部署

- **生产环境**: https://daily-movie.jiahongw.com
- **部署方式**: Cloudflare Pages 直连仓库，`main` 分支合并后自动构建部署
- **预览环境**: Cloudflare Pages 为每个 PR 生成预览链接（`daily-movie-xxx.pages.dev`）

## 主题与样式

- 主题 CSS 位于 `public/styles/anthropic-theme.css`（由 `Layout.astro` 直接 link）
- 当前主题：**Anthropic Amber**
  - Light（默认）：暖米背景 `#F5F4EF` + 文字 `#1A1A1A` + 强调 `#D4A800`
  - Dark（`[data-theme="dark"]`）：`#1A1A1A` 背景 + 强调 `#F5C518`
  - 字体：`-apple-system / Segoe UI / Noto Sans SC` 系统字体栈 + `JetBrains Mono`
  - 无像素字体、无扫描线（scanlines/pixel/neon 已在早期 PR 中移除）
- 主题切换按钮在 `Layout.astro` 内的 `#theme-toggle`，状态存于 `localStorage: daily-movie-theme`
- PWA `public/manifest.webmanifest` 的 `theme_color` 需要与当前主题的强调色保持同步

> 视觉规范变更（如 task #34「星夜色」主题重塑）：先看 `notes/daily-movie-*.md` 设计规范再动手，避免破坏现有 token 体系。同时留意 `public/sw.js` 的 `CACHE_NAME` 需要 bump 以让老客户端拿到新样式。

## 注意事项

1. **域名占用**: `daily-movie.pages.dev` 被他人注册为赌博站点，站点必须使用自定义域名 `daily-movie.jiahongw.com`
2. **图片资源**: 使用 Wikimedia Commons 等公开图源，确保版权合规
3. **数据校验**: 每次新增电影必须构建通过并跑 `npm run test`
4. **响应式**: 移动端 1 列、平板 2 列、桌面 3–4 列

## 开发规范

- 组件使用 `.astro` 后缀
- TypeScript 严格模式
- CSS 通过 `--bg-*` / `--text-*` / `--font-*` 变量管理，改主题只改 `public/styles/anthropic-theme.css` 的 token
- 图片使用 `loading="lazy"` 懒加载
- 外部链接统一 `target="_blank"` + `rel="noopener noreferrer"`

## 故障排查

### 构建失败
- 检查 `src/data/movies/*.md` frontmatter 格式（缩进、必填字段）
- Zod 校验错误会指向具体电影 `id` 和字段

### 部署失败
- 检查 Cloudflare Pages 构建日志（自定义域名 DNS / API Token）
- 确认 `main` 分支最新提交在 Pages 触发列表里

### 图片不显示
- 检查 URL 可访问性
- 确认格式（JPG/PNG/WebP）
- 检查图源 CORS / Referer

## 相关工具

- **写入子 Agent**: `agents/daily-movie-writer.md`（新增电影条目时优先使用）
- **视觉规范文档**: `notes/daily-movie-*.md`（如有，主题重塑前必读）
