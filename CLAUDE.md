# 每日电影项目指南

## 项目概述

daily-movie 每天推荐一部经典电影。项目基于 Astro 7 + Zod 4，运行在 Cloudflare Workers 上；预渲染页面与公共文件由 Workers Static Assets 分发，`/health.json` 由 Worker 按请求执行。

**线上地址**：https://daily-movie.jiahongw.com

## 技术栈

- **框架**: Astro 7
- **语言**: TypeScript
- **数据校验**: Zod 4
- **部署**: Cloudflare Workers + Static Assets（自定义域名 daily-movie.jiahongw.com）
- **测试**: Vitest（单测）+ Playwright（E2E）

## 目录结构

```
daily-movie/
├── src/
│   ├── components/     # Astro 组件（TodayHero / MovieList / MovieCard / MovieDetail / QuoteCard / HeroCinema / MovieDetailRitual）
│   ├── data/           # 电影数据（movies/*.md、movies.ts 加载器）
│   ├── layouts/        # 布局模板（Layout.astro）
│   ├── pages/          # 页面：index.astro / movie/[date].astro / 404.astro / health.json.ts / movies.json.ts / rss.xml.ts
│   └── schemas/        # Zod Schema（movie.ts、__tests__）
├── agents/             # 子 Agent 定义（daily-movie-writer.md）
├── public/             # 静态资源（styles、logo、favicon、fallback-poster、manifest 等）
├── tests/e2e/          # Playwright E2E（home.spec.ts）
├── wrangler.jsonc      # Worker、Static Assets、域名与可观测性配置
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
npm run verify         # 完整质量门禁
npm run deploy:dry-run # 验证 Worker 部署包但不发布
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
6. 合并到 `main` 后由 Cloudflare Workers Builds 自动验证并部署

## 数据格式

```md
---
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
---

# 电影标题

正文写策展备注。
```

## 部署

- **生产环境**: https://daily-movie.jiahongw.com
- **Worker 回退地址**: https://daily-movie.wujiahong2013.workers.dev
- **Pages 回退地址**: https://daily-movie-8ww.pages.dev
- **部署方式**: Cloudflare Workers Builds 连接仓库，`main` 分支合并后运行 `npm run verify` 与 `npx wrangler deploy`
- **质量门禁**: GitHub Actions 在 PR 和 `main` push 上运行 lint、类型检查、单测、E2E、依赖审计、构建与 Wrangler dry-run
- **配置真源**: `wrangler.jsonc`；控制台中的 Worker 路由必须同步回该文件

## 主题与样式

- 主题 CSS 位于 `public/styles/v2-theme.css`（由 `Layout.astro` 直接 link）
- 当前主题：**v2 放映厅**
  - 主色：奶白 `--paper`、墨黑 `--ink`、枯金 `--gold`
  - 字体：自托管 Cormorant Garamond + Noto Serif SC 子集
  - 没有主题切换；`Layout.astro` 只清理旧版 `daily-movie-theme` localStorage
- PWA `public/manifest.webmanifest` 与 `Layout.astro` 的 `theme-color` 需要保持同步

> 视觉规范变更前先看 `notes/daily-movie-v2-design-thinker.md`，避免破坏现有 token 体系。同时留意 `public/sw.js` 的 `CACHE_NAME` 需要 bump 以让老客户端拿到新样式。

## 注意事项

1. **域名占用**: `daily-movie.pages.dev` 被他人注册为赌博站点，生产站点必须使用自定义域名 `daily-movie.jiahongw.com`
2. **图片资源**: 使用 Wikimedia Commons 等公开图源，确保版权合规
3. **数据校验**: 每次新增电影必须构建通过并跑 `npm run test`
4. **响应式**: 移动端 1 列、平板 2 列、桌面 3–4 列

## 开发规范

- 组件使用 `.astro` 后缀
- TypeScript 严格模式
- CSS 通过 `--paper` / `--ink` / `--gold` / `--font-*` 变量管理，改主题只改 `public/styles/v2-theme.css` 的 token
- 图片使用 `loading="lazy"` 懒加载
- 外部链接统一 `target="_blank"` + `rel="noopener noreferrer"`

## 故障排查

### 构建失败
- 检查 `src/data/movies/*.md` frontmatter 格式（缩进、必填字段）
- Zod 校验错误会指向具体电影 `id` 和字段

### 部署失败
- 先检查 GitHub Actions 的 `CI` 工作流，再检查 Cloudflare Workers Builds 日志
- 确认 `main` 最新提交已触发 Workers Builds，且 `wrangler.jsonc` 中保留 Custom Domain

### 图片不显示
- 检查 URL 可访问性
- 确认格式（JPG/PNG/WebP）
- 检查图源 CORS / Referer

## 相关工具

- **写入子 Agent**: `agents/daily-movie-writer.md`（新增电影条目时优先使用）
- **视觉规范文档**: `notes/daily-movie-v2-design-thinker.md`（主题重塑前必读）
