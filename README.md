# Lemon Sour Blog

这是 `Lemon Sour` 的新版个人博客。站点以白色、留白和文字排版为主，内容分为两个板块：

- **工作**：代码、系统、人工智能与生物信息学研究笔记
- **生活**：阅读、影像、音乐和生活记录

## 目录

- `content/posts`：文章与文章资源
- `content/pages`：独立页面
- `src/assets`：样式和浏览器脚本
- `scripts`：构建、预览和写作脚本
- `public`：favicon 等静态文件
- `.github/workflows`：GitHub Pages 自动部署

## 本地使用

```bash
npm install
npm run build
npm run preview
```

预览地址为 `http://127.0.0.1:4173/`。

## 新建文章

```bash
npm run new -- "文章标题"
```

也可以把文章放入子目录：

```bash
npm run new -- "life/文章标题"
```

文章使用 Markdown 与 YAML front matter：

```yaml
---
title: 文章标题
date: 2026-09-26 18:00:00
tags:
- 随笔
categories:
- 生活
---
```

一级分类会决定文章所属板块：`代码`、`论文`、`学习笔记` 属于工作；`生活`、`影视书籍`、`音乐`、`其它` 属于生活。

## 发布

仓库推送至 GitHub 的 `main` 分支后，GitHub Actions 会构建 `dist` 并部署到 GitHub Pages。日常只发布文章时，也可以使用：

```bash
npm run publish:posts
```
