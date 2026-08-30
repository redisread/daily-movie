# 每日电影

每天推荐一部经典电影。项目运行在 Cloudflare Workers 上，由 Astro 同时提供预渲染页面与按需服务端路由，静态文件通过 Workers Static Assets 分发。

## 开发

```bash
npm install
npm run dev    # http://localhost:4321
```

## 构建

```bash
npm run build
npm run preview
npm run deploy:dry-run
```

## 添加电影

在 `src/data/movies/` 新增一篇 `{id}.md`，运行 `npm run test` 和 `npm run build` 验证 schema。

每篇 Markdown 文档使用 YAML frontmatter 保存结构化字段，正文保存策展备注。`quotes` 可以写 3–10 条语录，详情页会全部展示。

## 技术栈

- **运行时**: Cloudflare Workers + Workers Static Assets
- **框架**: [Astro](https://astro.build/)（SSR/SSG）
- **语言**: TypeScript
- **数据校验**: Zod
- **部署工具**: Wrangler
- **CI/CD**: GitHub Actions + Cloudflare Workers Builds Git Integration

内容页、电影详情、RSS、电影清单和 404 在构建时预渲染，由 Static Assets 直接提供；`/health.json` 在 Worker 中按请求执行。`wrangler.jsonc` 是 Worker 配置的唯一来源。

## 项目结构

```
daily-movie/
├── src/
│   ├── components/     # 组件
│   ├── data/          # Markdown 电影文档与加载器
│   ├── layouts/       # 布局
│   └── pages/         # 页面
├── public/            # 静态资源
├── .github/           # GitHub Actions 质量校验
├── wrangler.jsonc     # Worker、Static Assets 与可观测性配置
└── package.json
```

## 部署

GitHub Actions 只负责质量校验：在 Pull Request 和 `main` push 上运行 lint、类型检查、测试、依赖审计、构建和 Wrangler dry-run，不执行生产部署。

生产部署由 Cloudflare Workers Builds 的 Git Integration 负责，连接 `redisread/daily-movie` 并使用以下设置：

- 生产分支：`main`
- 构建命令：`npm run verify`
- 部署命令：`npx wrangler deploy`
- 根目录：`/`
- 非生产分支构建：关闭

`npm run verify` 会在 Cloudflare 构建环境中重新执行完整质量门禁，全部通过后才部署名为 `daily-movie` 的 Worker。Git Integration 使用 Cloudflare 管理的构建令牌，不依赖 GitHub Actions secrets。

先通过 Worker 的 `workers.dev` 地址验证，再把现有自定义域名从 Pages 切换到该 Worker；域名切换没有写入仓库配置，因此合并代码不会自动改动线上域名。

- **生产环境**: https://daily-movie.jiahongw.com
- **注意**: `daily-movie.pages.dev` 已被第三方占用，请勿使用；Worker 部署不依赖该 Pages 子域名

若 Worker 发布后需要回退，可在 Cloudflare Dashboard 的 Worker 部署历史中选择上一个版本，或使用 `npx wrangler rollback`。这只回退 Worker 版本，不会回退外部数据或域名配置。

## 许可证

MIT
