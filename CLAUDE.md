# 每日电影项目指南

## 项目概述

daily-movie 是一个静态站点，每天推荐一部经典电影。基于 Astro + Zod 构建，部署到 Cloudflare Pages。

**线上地址**：https://daily-movie.jiahongw.com

## 技术栈

- **框架**: Astro 6.4
- **语言**: TypeScript
- **数据校验**: Zod 4.4
- **部署**: Cloudflare Pages（自定义域名 daily-movie.jiahongw.com）
- **测试**: Vitest + Playwright

## 目录结构

```
daily-movie/
├── src/
│   ├── components/     # Astro 组件（MovieCard, FeaturedCard, CastList 等）
│   ├── data/          # 电影数据（movies.yaml）
│   ├── layouts/       # 布局模板（Layout.astro）
│   ├── pages/         # 页面（首页/详情/归档/搜索/RSS/JSON API）
│   ├── schemas/       # Zod Schema（movie.ts）
│   └── scripts/       # 客户端脚本（lightbox, poster-swipe）
├── public/            # 静态资源（favicon, robots.txt）
├── tests/             # Playwright E2E 测试
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
npm run typecheck
npm run test           # Vitest 单测
npm run test:e2e       # Playwright E2E 测试

# 数据校验
npm run validate:movies  # 校验 movies.yaml
```

## 添加电影

1. 编辑 `src/data/movies.yaml`，添加新电影条目
2. 确保所有必填字段：id, title, director, year, duration, genre, rating, cover, posters, cast, quotes, synopsis, publishedDate
3. 运行 `npm run validate:movies` 校验数据
4. 运行 `npm run test` 验证 Schema
5. 提交并推送到 main 分支
6. Cloudflare Pages 自动部署

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
- **部署方式**: Cloudflare Pages 自动从 main 分支部署
- **预览环境**: PR 自动生成预览链接（格式：`daily-movie-xxx.pages.dev`）

## 注意事项

1. **域名问题**: `daily-movie.pages.dev` 被他人注册为赌博网站，我们使用自定义域名 `daily-movie.jiahongw.com`
2. **图片资源**: 使用 Wikimedia Commons 等公开图片源，确保版权合规
3. **数据校验**: 每次添加电影必须运行 `npm run validate:movies`
4. **响应式设计**: 所有页面支持移动端（1列）、平板（2列）、桌面（3-4列）

## 开发规范

- 组件使用 `.astro` 后缀
- TypeScript 严格模式
- CSS 使用 CSS 变量管理主题（深色主题：#0f0f0f 背景，#f5c518 强调色）
- 图片使用 `loading="lazy"` 懒加载
- 所有外部链接使用 `target="_blank"` 和 `rel="noopener noreferrer"`

## 故障排查

### 构建失败
- 检查 `movies.yaml` 格式是否正确
- 运行 `npm run validate:movies` 查看详细错误
- 确保所有必填字段都存在

### 部署失败
- 检查 GitHub Actions 日志
- 确认 Cloudflare Pages 配置正确
- 检查自定义域名 DNS 设置

### 图片不显示
- 检查图片 URL 是否可访问
- 确认图片格式（JPG/PNG/WebP）
- 检查 CORS 设置

## 团队

- **产品**: @Steven
- **开发**: @Alex
- **架构/CR**: @Martin
- **决策**: @Victor
