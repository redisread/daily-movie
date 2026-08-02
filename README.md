# 每日电影

每天推荐一部经典电影。基于 Astro + Zod 的单页静态站点。

## 开发

```bash
npm install
npm run dev    # http://localhost:4321
```

## 构建

```bash
npm run build
npm run preview
```

## 添加电影

在 `src/data/movies/` 新增一篇 `{id}.md`，运行 `npm run test` 和 `npm run build` 验证 schema。

每篇 Markdown 文档使用 YAML frontmatter 保存结构化字段，正文保存策展备注。`quotes` 可以写 3–10 条语录，详情页会全部展示。

## 技术栈

- **框架**: [Astro](https://astro.build/)
- **语言**: TypeScript
- **数据校验**: Zod
- **部署**: Cloudflare Pages
- **CI/CD**: GitHub Actions

## 项目结构

```
daily-movie/
├── src/
│   ├── components/     # 组件
│   ├── data/          # Markdown 电影文档与加载器
│   ├── layouts/       # 布局
│   └── pages/         # 页面
├── public/            # 静态资源
├── .github/           # GitHub Actions
└── package.json
```

## 部署

项目通过 GitHub Actions 自动部署到 Cloudflare Pages。

- **生产环境**: https://daily-movie.jiahongw.com
- **注意**: `daily-movie.pages.dev` 已被第三方占用，请勿使用

## 许可证

MIT
