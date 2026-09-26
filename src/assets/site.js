const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function activateMath(root = document.body) {
  if (typeof window.renderMathInElement !== "function") {
    return;
  }

  window.renderMathInElement(root, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
      { left: "\\[", right: "\\]", display: true }
    ],
    throwOnError: false,
    strict: "ignore",
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
  });
}

function formatCodeLanguage(value) {
  const aliases = {
    bash: "Shell",
    c: "C",
    cpp: "C++",
    css: "CSS",
    html: "HTML",
    javascript: "JavaScript",
    js: "JavaScript",
    json: "JSON",
    markdown: "Markdown",
    md: "Markdown",
    python: "Python",
    py: "Python",
    shell: "Shell",
    text: "Text",
    typescript: "TypeScript",
    ts: "TypeScript",
    yaml: "YAML",
    yml: "YAML"
  };
  const normalized = String(value || "text").toLowerCase();
  return aliases[normalized] || normalized.toUpperCase();
}

function initCodeBlocks(root = document) {
  root.querySelectorAll("pre").forEach((pre) => {
    if (pre.closest(".code-frame")) {
      return;
    }

    const code = pre.querySelector("code");
    if (!code || !pre.parentNode) {
      return;
    }

    const frame = document.createElement("div");
    frame.className = "code-frame";
    const toolbar = document.createElement("div");
    toolbar.className = "code-frame__toolbar";

    const language = document.createElement("span");
    language.className = "code-frame__language";
    language.textContent = formatCodeLanguage(pre.dataset.language);

    const copy = document.createElement("button");
    copy.className = "code-frame__copy";
    copy.type = "button";
    copy.textContent = "复制";
    copy.setAttribute("aria-label", "复制代码");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.innerText);
        copy.textContent = "已复制";
      } catch {
        copy.textContent = "复制失败";
      }
      window.setTimeout(() => {
        copy.textContent = "复制";
      }, 1600);
    });

    toolbar.append(language, copy);
    pre.parentNode.insertBefore(frame, pre);
    frame.append(toolbar, pre);
  });
}

function initMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-menu]");
  if (!toggle || !menu) {
    return;
  }

  toggle.addEventListener("click", () => {
    const nextState = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", nextState);
    document.body.classList.toggle("is-menu-open", nextState);
  });
}

function initToc() {
  const toc = document.querySelector("[data-toc]");
  if (!toc) {
    return;
  }

  const links = [...toc.querySelectorAll("[data-toc-link]")];
  const entries = links
    .map((link) => {
      const id = decodeURIComponent((link.getAttribute("href") || "").replace(/^#/, ""));
      return { link, heading: document.getElementById(id) };
    })
    .filter((entry) => entry.heading);

  if (!entries.length) {
    return;
  }

  const details = toc.querySelector("details");
  const wideViewport = window.matchMedia("(min-width: 1240px)");
  if (details) {
    details.open = wideViewport.matches;
    const syncTocState = () => {
      toc.classList.toggle("is-collapsed", !details.open);
    };
    details.addEventListener("toggle", syncTocState);
    syncTocState();

    for (const link of links) {
      link.addEventListener("click", () => {
        if (!wideViewport.matches) {
          details.open = false;
        }
      });
    }
  }

  let frame = 0;
  let activeLink = null;
  const update = () => {
    frame = 0;
    const threshold = Math.min(160, window.innerHeight * 0.25);
    let active = entries[0];
    for (const entry of entries) {
      if (entry.heading.getBoundingClientRect().top <= threshold) {
        active = entry;
      } else {
        break;
      }
    }

    for (const entry of entries) {
      const isActive = entry === active;
      entry.link.classList.toggle("is-active", isActive);
      if (isActive) {
        entry.link.setAttribute("aria-current", "location");
      } else {
        entry.link.removeAttribute("aria-current");
      }
    }

    if (active.link !== activeLink) {
      activeLink = active.link;
      const linkTop = activeLink.offsetTop;
      const linkBottom = linkTop + activeLink.offsetHeight;
      const visibleTop = toc.scrollTop + 48;
      const visibleBottom = toc.scrollTop + toc.clientHeight - 32;
      if (details?.open && toc.scrollHeight > toc.clientHeight && (linkTop < visibleTop || linkBottom > visibleBottom)) {
        toc.scrollTo({
          top: Math.max(0, linkTop - toc.clientHeight / 3),
          behavior: "smooth"
        });
      }
    }
  };

  const scheduleUpdate = () => {
    if (!frame) {
      frame = window.requestAnimationFrame(update);
    }
  };

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("hashchange", scheduleUpdate);
  update();
}

async function unlockProtectedPost(root) {
  const form = root.querySelector("[data-protected-form]");
  const status = root.querySelector("[data-protected-status]");
  const payloadNode = root.querySelector("[data-protected-payload]");
  const content = root.querySelector("[data-protected-content]");
  if (!form || !status || !payloadNode || !content) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const password = String(formData.get("password") || "");
    if (!password) {
      status.textContent = "请输入密码。";
      return;
    }

    try {
      const payload = JSON.parse(payloadNode.textContent || "{}");
      const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, [
        "deriveKey"
      ]);
      const key = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: base64ToBytes(payload.salt),
          iterations: payload.iterations,
          hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
        key,
        base64ToBytes(payload.data)
      );

      content.innerHTML = textDecoder.decode(decrypted);
      content.hidden = false;
      form.hidden = true;
      status.textContent = "已解锁。";
      root.classList.add("is-unlocked");

      initCodeBlocks(content);
      activateMath(content);
    } catch {
      status.textContent = "密码不正确，或者这篇文章无法解锁。";
    }
  });
}

function initProtectedPosts() {
  document.querySelectorAll("[data-protected-post]").forEach((root) => {
    unlockProtectedPost(root);
  });
}

function scoreItem(item, terms) {
  const title = item.title.toLowerCase();
  const categories = item.categories.join(" ").toLowerCase();
  const tags = item.tags.join(" ").toLowerCase();
  const summary = item.summary.toLowerCase();
  const content = item.content.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (!term) {
      continue;
    }
    if (title.includes(term)) {
      score += 8;
    }
    if (categories.includes(term)) {
      score += 4;
    }
    if (tags.includes(term)) {
      score += 4;
    }
    if (summary.includes(term)) {
      score += 3;
    }
    if (content.includes(term)) {
      score += 1;
    }
  }

  return score;
}

function renderSearchResults(container, items) {
  if (!items.length) {
    container.innerHTML = '<p class="empty-state">没有找到相关内容。</p>';
    return;
  }

  container.innerHTML = items
    .map(
      ({ item }) => `
        <article class="search-result">
          <div class="search-result__meta">${escapeHtml(item.date)}${item.protected ? " · 私密" : ""}</div>
          <h2><a href="${item.url}">${escapeHtml(item.title)}</a></h2>
          <p>${escapeHtml(item.summary)}</p>
          <div class="search-result__pills">
            ${item.categories.map((category) => `<span class="pill" data-kind="category">${escapeHtml(category)}</span>`).join("")}
            ${item.tags.map((tag) => `<span class="pill" data-kind="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </article>
      `
    )
    .join("");
}

async function initSearch() {
  const root = document.querySelector("[data-search-root]");
  if (!root) {
    return;
  }

  const input = root.querySelector("[data-search-input]");
  const meta = root.querySelector("[data-search-meta]");
  const results = root.querySelector("[data-search-results]");
  if (!input || !meta || !results) {
    return;
  }

  let index = [];
  try {
    const response = await fetch("../search-index.json");
    index = await response.json();
    meta.textContent = "";
  } catch {
    meta.textContent = "搜索索引加载失败。";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("q")) {
    input.value = params.get("q") || "";
  }

  const run = () => {
    const query = input.value.trim().toLowerCase();
    const currentParams = new URLSearchParams(window.location.search);

    if (!query) {
      currentParams.delete("q");
      window.history.replaceState({}, "", `${window.location.pathname}${currentParams.toString() ? `?${currentParams}` : ""}`);
      meta.textContent = "";
      results.innerHTML = "";
      return;
    }

    currentParams.set("q", query);
    window.history.replaceState({}, "", `${window.location.pathname}?${currentParams.toString()}`);

    const terms = query.split(/\s+/).filter(Boolean);
    const ranked = index
      .map((item) => ({ item, score: scoreItem(item, terms) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || right.item.date.localeCompare(left.item.date))
      .slice(0, 50);

    meta.textContent = `找到 ${ranked.length} 条结果。`;
    renderSearchResults(results, ranked);
  };

  input.addEventListener("input", run);
  run();
}

document.addEventListener("DOMContentLoaded", () => {
  initMenu();
  initToc();
  initProtectedPosts();
  initSearch();
  initCodeBlocks(document);
  activateMath(document.body);
});
