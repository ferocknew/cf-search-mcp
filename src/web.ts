// Web 界面 HTML
// 参考 Yrobot/cloudflare-search 视觉(Tailwind CDN + zinc/blue + 暗色模式),改造为:
//   1) 降级链模式 → 引擎区只读展示降级顺序(非多选并行)
//   2) Token 模态弹框(参考项目无,本项目自研):服务端只注入 TOKEN_ENABLED 布尔,
//      token 值仅存浏览器 localStorage,绝不写入返回的 HTML
//   3) 第一版仅搜索界面
// 注意:客户端 <script> 内一律用字符串拼接,不用反引号模板字符串,
//       避免与服务端 ${} 求值冲突(无需转义 \${})。

export interface WebOptions {
  tokenEnabled: boolean;
  engines: string[];
}

export function getSearchHtml(opts: WebOptions): string {
  const { tokenEnabled, engines } = opts;
  const enginesReady = engines.length > 0;
  const statusTone =
    enginesReady && tokenEnabled
      ? "border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10"
      : "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10";

  // 引擎降级顺序 pill:序号 + 引擎名,服务端预渲染
  const enginePills = engines.length
    ? engines
        .map(
          (name, i) =>
            `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"><span class="opacity-60">${i + 1}</span>${name}</span>`
        )
        .join("")
    : '<span class="text-sm text-amber-600 dark:text-amber-400">未启用任何引擎 — 请配置 SEARCH_CONFIG 与对应 API key</span>';

  return `<!DOCTYPE html>
<html lang="zh-CN" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cf-search-mcp · 多引擎降级搜索</title>
  <meta name="description" content="基于 Cloudflare Workers 的多引擎降级搜索服务">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔍</text></svg>">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: { extend: { colors: {
        zinc: { 50:'#fafafa',100:'#f4f4f5',200:'#e4e4e7',300:'#d4d4d8',400:'#a1a1aa',500:'#71717a',600:'#52525b',700:'#3f3f46',800:'#27272a',900:'#18181b' },
        blue: { 400:'#60a5fa',500:'#3b82f6',600:'#2563eb' }
      } } }
    }
  </script>
  <style>
    :root { --bg-primary:#fafafa; --text-primary:#27272a; }
    @media (prefers-color-scheme: dark) { :root { --bg-primary:#000; --text-primary:#f4f4f5; } }
    body { background-color:var(--bg-primary); color:var(--text-primary); }
  </style>
</head>
<body class="flex h-full flex-col">
  <main class="flex-auto">
    <div class="mt-16 sm:mt-24">
      <div class="mx-auto w-full max-w-3xl px-4 sm:px-8">

        <!-- 标题区 -->
        <div>
          <div class="text-5xl mb-4">🔍</div>
          <h1 class="text-3xl font-bold tracking-tight text-zinc-800 sm:text-4xl dark:text-zinc-100">cf-search-mcp</h1>
          <p class="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            基于 Cloudflare Workers 的多引擎降级搜索服务。按权重依次尝试 tavily / serpapi / serper / search1api / jina / baidu,首个有结果即返回。
          </p>
        </div>

        <!-- 服务状态 -->
        <div class="mt-8 rounded-2xl border ${statusTone} p-6">
          <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">⚙️ 服务状态</h2>
          <div class="space-y-2 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-zinc-700 dark:text-zinc-300">启用引擎(按降级顺序)</span>
              <span class="${enginesReady ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}">${enginesReady ? "✓ 已配置" : "○ 未配置"}</span>
            </div>
            <div class="flex flex-wrap gap-2 pt-1">${enginePills}</div>
            <div class="flex items-center justify-between pt-2">
              <span class="text-zinc-700 dark:text-zinc-300">访问鉴权(TOKEN)</span>
              <span class="${tokenEnabled ? "text-green-600 dark:text-green-400" : "text-zinc-500 dark:text-zinc-500"}">${tokenEnabled ? "✓ 已启用" : "○ 未启用(公开访问)"}</span>
            </div>
          </div>
        </div>

        <!-- 搜索表单 -->
        <div class="mt-8 rounded-2xl border border-zinc-100 p-6 dark:border-zinc-700/40">
          <form id="searchForm" class="space-y-4">
            <div>
              <label for="searchQuery" class="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">搜索关键词</label>
              <input type="text" id="searchQuery" placeholder="输入您要搜索的内容..." required class="w-full rounded-md bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-500">
            </div>
            <button type="submit" id="searchBtn" class="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 dark:bg-blue-500 dark:hover:bg-blue-400">开始搜索</button>
          </form>
        </div>

        <!-- 结果区 -->
        <div id="resultsSection" class="mt-8 hidden">
          <div class="rounded-2xl border border-zinc-100 p-6 dark:border-zinc-700/40">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">搜索结果 <span id="resultCount" class="text-sm font-normal text-zinc-500"></span></h2>
              <button id="clearBtn" class="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">清除</button>
            </div>
            <div id="resultMeta" class="text-xs text-zinc-500 dark:text-zinc-400 mb-4"></div>
            <div id="results" class="space-y-3"></div>
          </div>
        </div>

        <!-- API 说明 -->
        <div class="mt-8 rounded-2xl border border-zinc-100 p-6 dark:border-zinc-700/40">
          <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">📖 API 用法</h2>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-3">除网页界面外,也可直接 HTTP 调用(支持 GET / POST)。</p>
          <div class="space-y-3 text-sm">
            <div class="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <div class="font-medium text-zinc-900 dark:text-zinc-100 mb-2">GET</div>
              <code class="text-xs text-blue-600 dark:text-blue-400 break-all block" id="apiExample1"></code>
            </div>
            <div class="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <div class="font-medium text-zinc-900 dark:text-zinc-100 mb-2">POST</div>
              <code class="text-xs text-blue-600 dark:text-blue-400 break-all block" id="apiExample2"></code>
            </div>
          </div>
          <div class="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
            参数:<code class="px-1 bg-zinc-100 dark:bg-zinc-800 rounded">q</code> 关键词(必填)、<code class="px-1 bg-zinc-100 dark:bg-zinc-800 rounded">engines</code> 引擎子集(可选)${tokenEnabled ? '、<code class="px-1 bg-zinc-100 dark:bg-zinc-800 rounded">token</code> 访问令牌(必填)' : ""}
          </div>
        </div>

        <!-- 页脚 -->
        <footer class="mt-16 mb-16 border-t border-zinc-100 pt-8 dark:border-zinc-700/40">
          <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p class="text-sm text-zinc-400 dark:text-zinc-500">Powered by Cloudflare Workers</p>
            <a href="https://github.com/ferocknew/cf-search-mcp" target="_blank" class="text-sm font-medium text-zinc-800 hover:text-blue-500 dark:text-zinc-200 dark:hover:text-blue-400">GitHub →</a>
          </div>
        </footer>

      </div>
    </div>
  </main>

  <!-- Token 模态弹框(仅 TOKEN_ENABLED 时由 JS 显示) -->
  <div id="tokenModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
      <h3 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">🔒 请输入访问令牌</h3>
      <p id="tokenModalHint" class="text-xs text-zinc-500 dark:text-zinc-400 mb-4">本服务已启用访问鉴权,请输入 TOKEN 后使用。</p>
      <input type="password" id="tokenInput" placeholder="输入 Token..." class="w-full rounded-md bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 mb-3">
      <button id="tokenSubmit" class="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-blue-500 dark:hover:bg-blue-400">确认</button>
    </div>
  </div>

  <script>
    (function () {
      var TOKEN_ENABLED = ${tokenEnabled};
      var origin = window.location.origin;
      var STORAGE_KEY = "cf_search_token";

      function $(id) { return document.getElementById(id); }
      var tokenInput = $("tokenInput");
      var tokenModal = $("tokenModal");
      var tokenModalHint = $("tokenModalHint");

      function getToken() {
        return TOKEN_ENABLED ? (localStorage.getItem(STORAGE_KEY) || "") : "";
      }
      function openTokenModal(hint) {
        if (hint) tokenModalHint.textContent = hint;
        tokenModal.classList.remove("hidden");
        tokenModal.classList.add("flex");
        setTimeout(function () { tokenInput.focus(); }, 0);
      }
      function closeTokenModal() {
        tokenModal.classList.add("hidden");
        tokenModal.classList.remove("flex");
      }
      function submitToken() {
        var v = tokenInput.value.trim();
        if (!v) return;
        localStorage.setItem(STORAGE_KEY, v);
        tokenInput.value = "";
        closeTokenModal();
        refreshApiExamples();
      }
      $("tokenSubmit").addEventListener("click", submitToken);
      tokenInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submitToken(); });

      // 初始化:启用鉴权且本地无 token → 弹框
      if (TOKEN_ENABLED && !getToken()) {
        openTokenModal("本服务已启用访问鉴权,请输入 TOKEN 后使用。");
      }

      function refreshApiExamples() {
        var t = getToken();
        var tok = TOKEN_ENABLED && t ? "&token=" + encodeURIComponent(t) : "";
        $("apiExample1").textContent = origin + "/search?q=cloudflare" + tok;
        $("apiExample2").textContent = 'curl -X POST "' + origin + '/search" -d "q=cloudflare' + tok + '"';
      }
      refreshApiExamples();

      // 搜索提交
      $("searchForm").addEventListener("submit", async function (e) {
        e.preventDefault();
        var query = $("searchQuery").value.trim();
        if (!query) return;
        if (TOKEN_ENABLED && !getToken()) { openTokenModal("请先输入 TOKEN 再搜索。"); return; }

        var btn = $("searchBtn");
        var orig = btn.textContent;
        btn.textContent = "搜索中...";
        btn.disabled = true;
        try {
          var url = origin + "/search?q=" + encodeURIComponent(query);
          var t = getToken();
          if (TOKEN_ENABLED && t) url += "&token=" + encodeURIComponent(t);
          var res = await fetch(url);
          if (res.status === 401) {
            localStorage.removeItem(STORAGE_KEY);
            openTokenModal("Token 无效或已过期,请重新输入。");
            return;
          }
          var data = await res.json();
          displayResults(data);
          refreshApiExamples();
        } catch (err) {
          alert("搜索失败: " + err.message);
        } finally {
          btn.textContent = orig;
          btn.disabled = false;
        }
      });

      function escapeHtml(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
      }

      function displayResults(data) {
        var section = $("resultsSection");
        var meta = $("resultMeta");
        var count = $("resultCount");
        var list = $("results");
        section.classList.remove("hidden");
        count.textContent = "(共 " + (data.number_of_results || 0) + " 条)";
        var tried = Array.isArray(data.tried_engines) ? data.tried_engines : [];
        meta.innerHTML = '命中引擎:<span class="font-medium text-zinc-700 dark:text-zinc-300">' + escapeHtml(data.engine_used || "无") + '</span>' + (tried.length ? " · 尝试顺序:" + tried.map(escapeHtml).join(" → ") : "");

        if (data.results && data.results.length) {
          list.innerHTML = data.results.map(function (r) {
            return '<div class="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">' +
              '<div class="flex items-start justify-between gap-3">' +
                '<div class="flex-1 min-w-0">' +
                  '<a href="' + escapeHtml(r.url) + '" target="_blank" class="text-base font-medium text-blue-600 dark:text-blue-400 hover:underline break-all">' + escapeHtml(r.title || "无标题") + '</a>' +
                  '<p class="text-xs text-zinc-500 dark:text-zinc-500 mt-1 break-all">' + escapeHtml(r.url) + '</p>' +
                  '<p class="text-sm text-zinc-700 dark:text-zinc-300 mt-2">' + escapeHtml(r.description || "暂无描述") + '</p>' +
                '</div>' +
                (r.engine ? '<span class="shrink-0 text-xs text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded">' + escapeHtml(r.engine) + '</span>' : "") +
              '</div>' +
            '</div>';
          }).join("");
        } else {
          list.innerHTML = '<p class="text-center text-zinc-500 dark:text-zinc-400 py-4">没有找到相关结果</p>';
        }
        section.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      $("clearBtn").addEventListener("click", function () {
        $("resultsSection").classList.add("hidden");
        $("results").innerHTML = "";
        $("resultMeta").innerHTML = "";
      });
    })();
  </script>
</body>
</html>`;
}
