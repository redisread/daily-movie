# 每日一电影

每日一电影推荐网站，发现经典好电影。

## 技术栈

- **框架**: [Astro](https://astro.build/)
- **语言**: TypeScript
- **样式**: CSS
- **数据校验**: Zod
- **部署**: Cloudflare Pages
- **CI/CD**: GitHub Actions

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build

# 预览构建结果
npm run preview
```

## 项目结构

```
daily-movie/
├── src/
│   ├── components/     # 组件
│   ├── data/          # 数据文件
│   ├── layouts/       # 布局
│   └── pages/         # 页面
├── public/            # 静态资源
├── .github/           # GitHub Actions
└── package.json
```

## 部署

项目通过 GitHub Actions 自动部署到 Cloudflare Pages。

- **生产环境**: daily-movie.jiahongw.com
- **预览环境**: PR 自动生成预览链接

## 许可证

MIT
