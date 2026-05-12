# Minimal Blog

这是一个完全独立于原 Hexo 工程的新博客目录，目标是：

- 风格简约，不依赖现成主题。
- 兼容原先 `source/_posts` 风格的 Markdown 写作。
- 可以直接部署到 `username.github.io`。
- 搜索在站内实现，不依赖 Algolia 之类第三方站点。
- 首页和文章页保留公开信息与邮箱联系方式。

## 目录结构

- `content/posts`：新的文章目录，迁移后的 Markdown 和本地资源都放这里。
- `scripts`：迁移、构建、预览脚本。
- `src/assets`：站点样式和前端脚本。
- `.github/workflows`：适合 GitHub Pages 的部署工作流。

## 常用命令

```bash
npm install
npm run migrate
npm run build
npm run preview
```

## 使用方式

1. 先修改 `site.config.mjs` 里的站点标题、描述和 `url`。
2. 迁移旧文章时运行 `npm run migrate`，它会把上一级 Hexo 的 `source/_posts` 复制到 `content/posts`。
3. 日常写作时，直接在 `content/posts` 下新增或编辑 `.md` 文件即可，front matter 继续沿用：

```yaml
---
title: 文章标题
date: 2026-05-12 20:00:00
tags:
- 随笔
- 音乐
categories:
- [生活,记录]
---
```

4. 构建后产物会输出到 `dist`。

## GitHub Pages

把这个 `minimal-blog` 文件夹作为一个独立仓库根目录上传到 GitHub 后：

1. 仓库名设为 `Amentiraz.github.io`。
2. 在 GitHub Pages 设置里选择 `GitHub Actions`。
3. 推送到 `main` 分支后，会自动构建并部署 `dist`。
