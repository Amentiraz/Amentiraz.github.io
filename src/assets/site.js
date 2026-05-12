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
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
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
    meta.textContent = `索引已加载，共 ${index.length} 篇文章。`;
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
      meta.textContent = `索引已加载，共 ${index.length} 篇文章。`;
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
  initProtectedPosts();
  initSearch();
  activateMath(document.body);
});
