# Minimal Blog

这是一个独立于原 Hexo 工程的新博客目录，适合直接部署到 GitHub Pages。

## 目录结构

- `content/posts`：文章和文章资源目录
- `scripts`：迁移、构建、预览、发布脚本
- `src/assets`：站点样式和前端脚本
- `.github/workflows`：GitHub Pages 自动部署工作流

## 常用命令

```bash
npm install
npm run migrate
npm run build
npm run preview
npm run publish:posts
```

## 日常写作

1. 直接在 `content/posts` 下新增或修改 `.md` 文件。
2. 如果文章有本地图片或附件，也放在 `content/posts` 下面对应的位置。
3. front matter 可以继续沿用原来的写法，例如：

```yaml
---
title: 文章标题
date: 2026-05-19 20:00:00
tags:
- 随笔
- 音乐
categories:
- [生活, 记录]
---
```

## 本地预览

```bash
npm run build
npm run preview
```

然后打开 `http://127.0.0.1:4173/`。

## 一键发布文章

写完文章后，直接运行：

```bash
npm run publish:posts
```

如果你想自定义提交说明，可以运行：

```bash
npm run publish:posts -- "Add new vLLM notes"
```

这个命令会自动完成：

1. 检查 `content/posts` 下是否真的有改动
2. 清理残留的 `.git/index.lock`（只会在没有运行中的 Git 进程时清理）
3. 构建站点
4. 只暂存 `content/posts` 下的文章和资源
5. 自动提交
6. 自动推送到当前分支对应的 GitHub 仓库

注意：

- 如果仓库里已经有别的“已暂存改动”，脚本会停止，避免把无关内容一起提交。
- `dist` 不需要手动提交，GitHub Actions 会自动重新构建并部署。

## GitHub Pages

把这个 `minimal-blog` 作为独立仓库根目录上传到 GitHub 后：

1. 仓库名设置为 `Amentiraz.github.io`
2. 在 GitHub Pages 设置里选择 `GitHub Actions`
3. 推送到 `main` 分支后，会自动构建并部署 `dist`
