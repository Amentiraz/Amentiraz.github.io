import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const MarkdownIt = require("markdown-it");
const yaml = require("js-yaml");
const hljs = require("highlight.js");
const CleanCSS = require("clean-css");
const markdownItFootnote = require("markdown-it-footnote");
const markdownItMark = require("markdown-it-mark");
const markdownItMultimdTable = require("markdown-it-multimd-table");
const markdownItSub = require("markdown-it-sub");
const markdownItSup = require("markdown-it-sup");
const markdownItTaskCheckbox = require("markdown-it-task-checkbox");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const { site } = await import(pathToFileURL(path.join(ROOT, "site.config.mjs")).href);

const CONTENT_DIR = path.join(ROOT, "content", "posts");
const OUT_DIR = path.join(ROOT, "dist");
const SRC_ASSETS_DIR = path.join(ROOT, "src", "assets");
const STATIC_DIR = path.join(ROOT, "public");
const KATEX_DIST = path.dirname(require.resolve("katex/dist/katex.min.css"));
const DATE_FORMATTER = new Intl.DateTimeFormat(site.language || "zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const md = createMarkdownRenderer();

function createMarkdownRenderer() {
  const instance = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
    highlight(code, language) {
      if (language && hljs.getLanguage(language)) {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language }).value}</code></pre>`;
      }
      return `<pre class="hljs"><code>${instance.utils.escapeHtml(code)}</code></pre>`;
    }
  });

  instance.use(markdownItFootnote);
  instance.use(markdownItMark);
  instance.use(markdownItMultimdTable, {
    multiline: true,
    rowspan: true,
    headerless: true
  });
  instance.use(markdownItSub);
  instance.use(markdownItSup);
  instance.use(markdownItTaskCheckbox, {
    disabled: true,
    divWrap: false,
    label: true
  });

  instance.core.ruler.push("collect_headings", (state) => {
    const usedIds = new Map();
    state.env.headings = [];

    for (let index = 0; index < state.tokens.length; index += 1) {
      const token = state.tokens[index];
      if (token.type !== "heading_open") {
        continue;
      }

      const inline = state.tokens[index + 1];
      const text = inline?.content?.trim() || `section-${index}`;
      const level = Number.parseInt(token.tag.replace("h", ""), 10) || 2;
      const baseId = slugifyHeading(text);
      const count = usedIds.get(baseId) || 0;
      const id = count > 0 ? `${baseId}-${count + 1}` : baseId;
      usedIds.set(baseId, count + 1);
      token.attrSet("id", id);
      state.env.headings.push({ text, level, id });
    }
  });

  const defaultLinkOpen =
    instance.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  instance.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet("href") || "";
    if (/^https?:\/\//i.test(href)) {
      tokens[idx].attrSet("target", "_blank");
      tokens[idx].attrSet("rel", "noreferrer noopener");
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return instance;
}

function slugifyHeading(text) {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fa5\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
  return cleaned || "section";
}

function safeSegment(value) {
  const cleaned = String(value)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-");
  return cleaned || "untitled";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function trimText(text, limit = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit).trimEnd()}…`;
}

function normalizeList(value) {
  const seen = new Set();
  const output = [];

  function visit(item) {
    if (item == null) {
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    const text = String(item).trim();
    if (!text || seen.has(text)) {
      return;
    }
    seen.add(text);
    output.push(text);
  }

  visit(value);
  return output;
}

function preprocessMarkdown(source) {
  return source
    .replace(/\{%\s*raw\s*%}/g, "")
    .replace(/\{%\s*endraw\s*%}/g, "")
    .replace(/\{%\s*dplayer\s+([^%]+?)\s*%}/g, (_, attributes) => {
      const match = attributes.match(/url=([^"\s]+)/);
      const url = match?.[1]?.trim();
      if (!url) {
        return "";
      }
      return [
        '<figure class="post-video">',
        `  <video controls preload="metadata" src="${escapeHtml(url)}"></video>`,
        "</figure>"
      ].join("\n");
    });
}

function renderMarkdown(source) {
  const env = {};
  const html = md
    .render(preprocessMarkdown(source), env)
    .replace(/<img /g, '<img loading="lazy" decoding="async" ');
  return {
    html,
    headings: env.headings || []
  };
}

function withBase(pathname = "/") {
  const base = site.basePath && site.basePath !== "/" ? site.basePath.replace(/\/$/, "") : "";
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${cleanPath}` || "/";
}

function toDate(value, fallback = new Date()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().replace(" ", "T");
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
}

function formatDate(date) {
  return DATE_FORMATTER.format(date).replace(/\//g, "-");
}

function formatDateMachine(date) {
  return date.toISOString().slice(0, 10);
}

function renderPills(values, lookup, type) {
  return values
    .map((value) => {
      const item = lookup.get(value);
      if (!item) {
        return "";
      }
      return `<a class="pill" href="${item.url}" data-kind="${type}">${escapeHtml(item.label)}</a>`;
    })
    .join("");
}

function renderHeadingToc(headings) {
  const filtered = headings.filter((item) => item.level >= 2 && item.level <= 3);
  if (filtered.length < 2) {
    return "";
  }
  const items = filtered
    .map(
      (item) =>
        `<a class="toc__item toc__item--level-${item.level}" href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a>`
    )
    .join("");
  return [
    '<aside class="toc">',
    '  <div class="toc__title">目录</div>',
    `  <div class="toc__items">${items}</div>`,
    "</aside>"
  ].join("\n");
}

function readingMinutes(text) {
  return Math.max(1, Math.round(text.length / 450));
}

function encryptHtml(html, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(html, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return {
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    data: encrypted.toString("base64"),
    iterations: 120000
  };
}

function serializeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function renderProtectedContent(post) {
  const payload = encryptHtml(post.contentHtml, post.password);
  return [
    '<section class="protected-post" data-protected-post>',
    "  <div class=\"protected-post__intro\">",
    "    <div class=\"eyebrow\">需要密码</div>",
    `    <p>${escapeHtml(post.abstract || post.summaryText || "这是一篇仅对知道密码的人开放的文章。")}</p>`,
    post.message ? `    <p class="protected-post__message">${escapeHtml(post.message)}</p>` : "",
    "  </div>",
    "  <form class=\"protected-post__form\" data-protected-form>",
    "    <input type=\"password\" name=\"password\" placeholder=\"输入密码解锁\" autocomplete=\"current-password\" />",
    "    <button type=\"submit\">解锁</button>",
    "  </form>",
    "  <p class=\"protected-post__status\" data-protected-status></p>",
    `  <script type="application/json" data-protected-payload>${serializeJson(payload)}</script>`,
    "  <div class=\"post-body\" data-protected-content hidden></div>",
    "</section>"
  ].join("\n");
}

function renderPublicInfoCard({ compact = false } = {}) {
  return [
    `<section class="public-card${compact ? " public-card--compact" : ""}">`,
    `  <div class="eyebrow">${escapeHtml(site.profileTitle || "公开信息")}</div>`,
    `  <h2>${escapeHtml(site.author)}</h2>`,
    `  <p>${escapeHtml(site.profileIntro || "")}</p>`,
    '  <div class="public-card__items">',
    '    <div class="public-card__item">',
    '      <span class="public-card__label">邮箱</span>',
    `      <a class="public-card__value" href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a>`,
    "    </div>",
    "  </div>",
    "</section>"
  ].join("\n");
}

function renderPagination(currentPage, totalPages, hrefBuilder) {
  if (totalPages <= 1) {
    return "";
  }
  const links = [];
  if (currentPage > 1) {
    links.push(`<a class="pager__nav" href="${hrefBuilder(currentPage - 1)}">上一页</a>`);
  }
  for (let page = 1; page <= totalPages; page += 1) {
    links.push(
      `<a class="pager__page${page === currentPage ? " is-active" : ""}" href="${hrefBuilder(page)}">${page}</a>`
    );
  }
  if (currentPage < totalPages) {
    links.push(`<a class="pager__nav" href="${hrefBuilder(currentPage + 1)}">下一页</a>`);
  }
  return `<nav class="pager">${links.join("")}</nav>`;
}

function renderCard(post, lookups) {
  return [
    '<article class="post-card">',
    `  <div class="post-card__meta">${escapeHtml(formatDate(post.date))} · ${post.readingMinutes} 分钟阅读${post.protected ? " · 私密" : ""}</div>`,
    `  <h2><a href="${post.url}">${escapeHtml(post.title)}</a></h2>`,
    `  <p>${escapeHtml(post.summaryText)}</p>`,
    `  <div class="post-card__pills">${renderPills(post.categories, lookups.categoryLookup, "category")}${renderPills(post.tags, lookups.tagLookup, "tag")}</div>`,
    "</article>"
  ].join("\n");
}

function renderArchiveGroups(posts) {
  const groups = new Map();
  for (const post of posts) {
    const year = post.date.getFullYear();
    if (!groups.has(year)) {
      groups.set(year, []);
    }
    groups.get(year).push(post);
  }

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => {
      const lines = items
        .map(
          (post) =>
            `<a class="archive-item" href="${post.url}"><span>${escapeHtml(post.title)}</span><time datetime="${formatDateMachine(post.date)}">${escapeHtml(formatDate(post.date))}</time></a>`
        )
        .join("");
      return `<section class="archive-group"><h2>${year}</h2><div class="archive-group__items">${lines}</div></section>`;
    })
    .join("");
}

function renderTaxonomyIndex(items, title, singular) {
  const cards = items
    .map(
      (item) =>
        `<a class="taxonomy-card" href="${item.url}"><span class="taxonomy-card__label">${escapeHtml(item.label)}</span><span class="taxonomy-card__count">${item.count} 篇${escapeHtml(singular)}</span></a>`
    )
    .join("");
  return cards || '<p class="empty-state">这里还没有内容。</p>';
}

function renderNav(activeHref) {
  const items = [
    { label: "首页", href: withBase("/") },
    { label: "归档", href: withBase("/archives/") },
    { label: "标签", href: withBase("/tags/") },
    { label: "分类", href: withBase("/categories/") },
    { label: "搜索", href: withBase("/search/") }
  ];

  const links = items
    .map((item) => {
      const active = activeHref === item.href ? " is-active" : "";
      return `<a class="site-nav__link${active}" href="${item.href}">${item.label}</a>`;
    })
    .join("");

  return [
    "<header class=\"site-header\">",
    "  <div class=\"shell shell--wide site-header__inner\">",
    `    <a class="brand" href="${withBase("/")}">`,
    `      <span class="brand__title">${escapeHtml(site.title)}</span>`,
    `      <span class="brand__tagline">${escapeHtml(site.tagline)}</span>`,
    "    </a>",
    "    <button class=\"menu-toggle\" type=\"button\" data-menu-toggle aria-label=\"切换导航\">菜单</button>",
    `    <nav class="site-nav" data-menu>${links}</nav>`,
    "  </div>",
    "</header>"
  ].join("\n");
}

function renderShell({ pageTitle, description, activeHref, content, bodyClass = "", extraHead = "" }) {
  const title = pageTitle ? `${pageTitle} | ${site.title}` : site.title;
  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(site.language || "zh-CN")}">`,
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(title)}</title>`,
    `  <meta name="description" content="${escapeHtml(description || site.description)}" />`,
    `  <link rel="stylesheet" href="${withBase("/assets/styles.css")}" />`,
    `  <link rel="stylesheet" href="${withBase("/assets/vendor/katex/katex.min.css")}" />`,
    extraHead,
    `  <script defer src="${withBase("/assets/vendor/katex/katex.min.js")}"></script>`,
    `  <script defer src="${withBase("/assets/vendor/katex/auto-render.min.js")}"></script>`,
    `  <script defer src="${withBase("/assets/site.js")}"></script>`,
    "</head>",
    `<body class="${escapeHtml(bodyClass)}">`,
    renderNav(activeHref),
    "  <main>",
    content,
    "  </main>",
    "  <footer class=\"site-footer\">",
    "    <div class=\"shell shell--wide\">",
    `      <p>${escapeHtml(site.footerNote)}</p>`,
    "    </div>",
    "  </footer>",
    "</body>",
    "</html>"
  ].join("\n");
}

function homeIntro(stats) {
  return [
    '<section class="hero shell shell--wide">',
    '  <div class="hero__copy">',
    '    <div class="eyebrow">Minimal blog</div>',
    `    <h1>${escapeHtml(site.title)}</h1>`,
    `    <p class="hero__lead">${escapeHtml(site.description)}</p>`,
    '    <div class="hero__stats">',
    `      <div><strong>${stats.postCount}</strong><span>篇文章</span></div>`,
    `      <div><strong>${stats.tagCount}</strong><span>个标签</span></div>`,
    `      <div><strong>${stats.categoryCount}</strong><span>个分类</span></div>`,
    "    </div>",
    "  </div>",
    '  <aside class="hero__aside">',
    `    ${renderPublicInfoCard({ compact: true })}`,
    "  </aside>",
    "</section>"
  ].join("\n");
}

function listPage({ title, description, activeHref, intro, posts, lookups, pagination = "" }) {
  const cards = posts.length
    ? posts.map((post) => renderCard(post, lookups)).join("\n")
    : '<p class="empty-state">这里还没有内容。</p>';

  return renderShell({
    pageTitle: title,
    description,
    activeHref,
    bodyClass: "page-list",
    content: [
      intro,
      '<section class="shell shell--wide listing">',
      `  <div class="section-heading"><h2>${escapeHtml(title || "文章")}</h2></div>`,
      `  <div class="post-grid">${cards}</div>`,
      pagination,
      "</section>"
    ].join("\n")
  });
}

function buildLookup(labels, basePathName, postsByLabel) {
  const entries = [];
  const used = new Set();

  for (const label of [...labels].sort((left, right) => left.localeCompare(right, "zh-CN"))) {
    const baseSegment = safeSegment(label);
    let segment = baseSegment;
    let counter = 2;
    while (used.has(segment)) {
      segment = `${baseSegment}-${counter}`;
      counter += 1;
    }
    used.add(segment);
    entries.push({
      label,
      segment,
      url: withBase(`/${basePathName}/${encodeURIComponent(segment)}/`),
      count: postsByLabel.get(label)?.length || 0
    });
  }

  return new Map(entries.map((entry) => [entry.label, entry]));
}

async function listMarkdownFiles(root) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files;
}

async function copyDirectory(sourceDir, targetDir, { skipIfExists = false, overwrite = false } = {}) {
  if (!existsSync(sourceDir)) {
    return;
  }
  if (skipIfExists && existsSync(targetDir)) {
    return;
  }
  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  await fs.cp(sourceDir, targetDir, {
    recursive: true,
    force: overwrite,
    errorOnExist: false
  });
}

function postUrlFromRelative(relativePathWithoutExtension) {
  const segments = relativePathWithoutExtension.split("/").map((segment) => encodeURIComponent(segment));
  return withBase(`/posts/${segments.join("/")}/`);
}

async function loadPosts() {
  if (!existsSync(CONTENT_DIR)) {
    return [];
  }

  const files = await listMarkdownFiles(CONTENT_DIR);
  const posts = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, "utf8");
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    const frontMatter = match ? yaml.load(match[1]) || {} : {};
    const markdown = match ? source.slice(match[0].length) : source;
    const stat = await fs.stat(filePath);
    const relativeFile = path.relative(CONTENT_DIR, filePath).replace(/\\/g, "/");
    const relativeWithoutExtension = relativeFile.replace(/\.md$/i, "");
    const title = String(frontMatter.title || path.basename(relativeWithoutExtension)).trim();
    const date = toDate(frontMatter.date, stat.mtime);
    const categories = normalizeList(frontMatter.categories ?? frontMatter.categorites);
    const tags = normalizeList(frontMatter.tags);
    const protectedPost = frontMatter.password ? String(frontMatter.password) : "";
    const abstract = frontMatter.abstract ? String(frontMatter.abstract).trim() : "";
    const message = frontMatter.message ? String(frontMatter.message).trim() : "";
    const withMore = markdown.split(/<!--more-->/i);
    const summarySource = withMore[0] || markdown;
    const summaryRender = renderMarkdown(summarySource);
    const fullRender = renderMarkdown(markdown);
    const summaryText =
      abstract ||
      trimText(stripHtml(summaryRender.html || fullRender.html), 180) ||
      trimText(stripHtml(fullRender.html), 180);
    const contentText = protectedPost ? summaryText : stripHtml(fullRender.html);
    const assetDirectory = path.join(CONTENT_DIR, ...relativeWithoutExtension.split("/"));

    posts.push({
      id: relativeWithoutExtension,
      filePath,
      relativeFile,
      relativeWithoutExtension,
      title,
      date,
      tags,
      categories,
      sticky: Boolean(frontMatter.sticky),
      math: Boolean(frontMatter.math),
      password: protectedPost,
      abstract,
      message,
      summaryHtml: summaryRender.html,
      summaryText,
      contentHtml: fullRender.html,
      contentText,
      headings: fullRender.headings,
      url: postUrlFromRelative(relativeWithoutExtension),
      outputDir: path.join(OUT_DIR, "posts", ...relativeWithoutExtension.split("/")),
      assetDirectory,
      readingMinutes: readingMinutes(contentText)
    });
  }

  posts.sort((left, right) => right.date.getTime() - left.date.getTime());
  return posts;
}

async function writeFile(targetPath, content) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}

async function copyAssets() {
  const cssSource = await fs.readFile(path.join(SRC_ASSETS_DIR, "styles.css"), "utf8");
  const cssOutput = new CleanCSS().minify(cssSource).styles;
  await writeFile(path.join(OUT_DIR, "assets", "styles.css"), cssOutput);
  await fs.copyFile(path.join(SRC_ASSETS_DIR, "site.js"), path.join(OUT_DIR, "assets", "site.js"));

  const katexOutDir = path.join(OUT_DIR, "assets", "vendor", "katex");
  await fs.mkdir(katexOutDir, { recursive: true });
  await copyDirectory(path.join(KATEX_DIST, "fonts"), path.join(katexOutDir, "fonts"), { skipIfExists: true });

  const vendorFiles = [
    ["katex.min.css", "katex.min.css"],
    ["katex.min.js", "katex.min.js"],
    [path.join("contrib", "auto-render.min.js"), "auto-render.min.js"]
  ];

  for (const [sourceName, outputName] of vendorFiles) {
    const sourcePath = path.join(KATEX_DIST, sourceName);
    const outputPath = path.join(katexOutDir, outputName);
    if (!existsSync(outputPath)) {
      await fs.copyFile(sourcePath, outputPath);
    }
  }

  if (existsSync(STATIC_DIR)) {
    await copyDirectory(STATIC_DIR, OUT_DIR);
  }
}

async function buildPostPages(posts, lookups) {
  for (const post of posts) {
    await fs.mkdir(post.outputDir, { recursive: true });
    if (existsSync(post.assetDirectory)) {
      await copyDirectory(post.assetDirectory, post.outputDir);
    }

    const bodyContent = post.password
      ? renderProtectedContent(post)
      : `${renderHeadingToc(post.headings)}<div class="post-body">${post.contentHtml}</div>`;

    const page = renderShell({
      pageTitle: post.title,
      description: post.summaryText,
      activeHref: "",
      bodyClass: "page-post",
      content: [
        '<article class="shell post-shell">',
        '  <header class="post-header">',
        post.categories.length
          ? `    <div class="eyebrow">${escapeHtml(post.categories.join(" / "))}</div>`
          : '    <div class="eyebrow">文章</div>',
        `    <h1>${escapeHtml(post.title)}</h1>`,
        `    <div class="post-header__meta"><time datetime="${formatDateMachine(post.date)}">${escapeHtml(formatDate(post.date))}</time><span>${post.readingMinutes} 分钟阅读</span></div>`,
        `    <div class="post-header__pills">${renderPills(post.categories, lookups.categoryLookup, "category")}${renderPills(post.tags, lookups.tagLookup, "tag")}</div>`,
        "  </header>",
        bodyContent,
        renderPublicInfoCard(),
        "</article>"
      ].join("\n")
    });

    await writeFile(path.join(post.outputDir, "index.html"), page);
  }
}

async function buildHomePages(posts, lookups, stats) {
  const totalPages = Math.max(1, Math.ceil(posts.length / site.postsPerPage));

  for (let page = 1; page <= totalPages; page += 1) {
    const start = (page - 1) * site.postsPerPage;
    const pagePosts = posts.slice(start, start + site.postsPerPage);
    const pagination = renderPagination(page, totalPages, (current) =>
      current === 1 ? withBase("/") : withBase(`/page/${current}/`)
    );

    const intro =
      page === 1
        ? homeIntro(stats)
        : `<section class="shell shell--wide page-intro"><div class="section-heading"><h1>第 ${page} 页</h1><p>继续往前翻翻。</p></div></section>`;

    const html = listPage({
      title: page === 1 ? "最新文章" : `第 ${page} 页`,
      description: site.description,
      activeHref: withBase("/"),
      intro,
      posts: pagePosts,
      lookups,
      pagination
    });

    const outputDir = page === 1 ? OUT_DIR : path.join(OUT_DIR, "page", String(page));
    await writeFile(path.join(outputDir, "index.html"), html);
  }
}

async function buildArchivePage(posts) {
  const html = renderShell({
    pageTitle: "归档",
    description: "按时间查看全部文章。",
    activeHref: withBase("/archives/"),
    bodyClass: "page-archive",
    content: [
      '<section class="shell shell--wide page-intro">',
      '  <div class="section-heading"><h1>归档</h1><p>按年份顺着读下来，会很清楚地看到写作轨迹。</p></div>',
      "</section>",
      `<section class="shell shell--wide archive">${renderArchiveGroups(posts)}</section>`
    ].join("\n")
  });

  await writeFile(path.join(OUT_DIR, "archives", "index.html"), html);
}

async function buildTaxonomyPages(posts, lookups) {
  const tagPosts = new Map();
  const categoryPosts = new Map();

  for (const post of posts) {
    for (const tag of post.tags) {
      if (!tagPosts.has(tag)) {
        tagPosts.set(tag, []);
      }
      tagPosts.get(tag).push(post);
    }
    for (const category of post.categories) {
      if (!categoryPosts.has(category)) {
        categoryPosts.set(category, []);
      }
      categoryPosts.get(category).push(post);
    }
  }

  const tagItems = [...lookups.tagLookup.values()].sort((left, right) => right.count - left.count);
  const categoryItems = [...lookups.categoryLookup.values()].sort((left, right) => right.count - left.count);

  const tagIndex = renderShell({
    pageTitle: "标签",
    description: "全部标签。",
    activeHref: withBase("/tags/"),
    bodyClass: "page-taxonomy",
    content: [
      '<section class="shell shell--wide page-intro">',
      '  <div class="section-heading"><h1>标签</h1><p>按主题快速找文章。</p></div>',
      "</section>",
      `<section class="shell shell--wide taxonomy-grid">${renderTaxonomyIndex(tagItems, "标签", "标签")}</section>`
    ].join("\n")
  });

  const categoryIndex = renderShell({
    pageTitle: "分类",
    description: "全部分类。",
    activeHref: withBase("/categories/"),
    bodyClass: "page-taxonomy",
    content: [
      '<section class="shell shell--wide page-intro">',
      '  <div class="section-heading"><h1>分类</h1><p>按类别整理过的写作内容。</p></div>',
      "</section>",
      `<section class="shell shell--wide taxonomy-grid">${renderTaxonomyIndex(categoryItems, "分类", "分类")}</section>`
    ].join("\n")
  });

  await writeFile(path.join(OUT_DIR, "tags", "index.html"), tagIndex);
  await writeFile(path.join(OUT_DIR, "categories", "index.html"), categoryIndex);

  for (const item of tagItems) {
    const html = listPage({
      title: `标签：${item.label}`,
      description: `${item.label} 相关文章`,
      activeHref: withBase("/tags/"),
      intro: [
        '<section class="shell shell--wide page-intro">',
        `  <div class="section-heading"><h1>${escapeHtml(item.label)}</h1><p>${item.count} 篇文章</p></div>`,
        "</section>"
      ].join("\n"),
      posts: tagPosts.get(item.label) || [],
      lookups
    });
    await writeFile(path.join(OUT_DIR, "tags", item.segment, "index.html"), html);
  }

  for (const item of categoryItems) {
    const html = listPage({
      title: `分类：${item.label}`,
      description: `${item.label} 相关文章`,
      activeHref: withBase("/categories/"),
      intro: [
        '<section class="shell shell--wide page-intro">',
        `  <div class="section-heading"><h1>${escapeHtml(item.label)}</h1><p>${item.count} 篇文章</p></div>`,
        "</section>"
      ].join("\n"),
      posts: categoryPosts.get(item.label) || [],
      lookups
    });
    await writeFile(path.join(OUT_DIR, "categories", item.segment, "index.html"), html);
  }
}

async function buildSearchPage() {
  const html = renderShell({
    pageTitle: "搜索",
    description: "本地搜索，不依赖第三方索引。",
    activeHref: withBase("/search/"),
    bodyClass: "page-search",
    content: [
      '<section class="shell shell--wide page-intro">',
      '  <div class="section-heading"><h1>搜索</h1><p>索引文件随站点一起生成，搜索不依赖外部服务。</p></div>',
      "</section>",
      '<section class="shell shell--wide search-panel" data-search-root>',
      `  <label class="search-box"><span>输入关键词</span><input data-search-input type="search" placeholder="${escapeHtml(site.searchPlaceholder)}" /></label>`,
      '  <div class="search-meta" data-search-meta>输入关键词后开始搜索。</div>',
      '  <div class="search-results" data-search-results></div>',
      "</section>"
    ].join("\n")
  });

  await writeFile(path.join(OUT_DIR, "search", "index.html"), html);
}

async function buildSearchIndex(posts) {
  const searchItems = posts.map((post) => ({
    title: post.title,
    url: post.url,
    date: formatDate(post.date),
    tags: post.tags,
    categories: post.categories,
    summary: post.summaryText,
    content: post.password ? post.summaryText : trimText(post.contentText, 5000),
    protected: Boolean(post.password)
  }));

  await writeFile(path.join(OUT_DIR, "search-index.json"), JSON.stringify(searchItems, null, 2));
}

async function build404Page() {
  const html = renderShell({
    pageTitle: "404",
    description: "页面不存在。",
    activeHref: "",
    bodyClass: "page-404",
    content: [
      '<section class="shell shell--wide not-found">',
      '  <div class="section-heading">',
      "    <h1>页面不存在</h1>",
      "    <p>也许文章已经换了位置，或者链接写错了。</p>",
      `    <a class="button-link" href="${withBase("/")}">回到首页</a>`,
      "  </div>",
      "</section>"
    ].join("\n")
  });
  await writeFile(path.join(OUT_DIR, "404.html"), html);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const posts = await loadPosts();
  const tags = new Set(posts.flatMap((post) => post.tags));
  const categories = new Set(posts.flatMap((post) => post.categories));

  const postsByTag = new Map();
  const postsByCategory = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!postsByTag.has(tag)) {
        postsByTag.set(tag, []);
      }
      postsByTag.get(tag).push(post);
    }
    for (const category of post.categories) {
      if (!postsByCategory.has(category)) {
        postsByCategory.set(category, []);
      }
      postsByCategory.get(category).push(post);
    }
  }

  const tagLookup = buildLookup(tags, "tags", postsByTag);
  const categoryLookup = buildLookup(categories, "categories", postsByCategory);
  const lookups = { tagLookup, categoryLookup };
  const stats = {
    postCount: posts.length,
    tagCount: tags.size,
    categoryCount: categories.size
  };

  await copyAssets();
  await buildPostPages(posts, lookups);
  await buildHomePages(posts, lookups, stats);
  await buildArchivePage(posts);
  await buildTaxonomyPages(posts, lookups);
  await buildSearchPage();
  await buildSearchIndex(posts);
  await build404Page();
  await writeFile(path.join(OUT_DIR, ".nojekyll"), "");

  console.log(`Built ${posts.length} posts to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
