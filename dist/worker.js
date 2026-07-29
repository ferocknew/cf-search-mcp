// src/env.ts
var DEFAULTS = {
  // 单引擎超时(毫秒),付费 API 比免费 HTML 解析慢,默认给宽裕些
  DEFAULT_TIMEOUT: "8000"
};
var _env = { ...DEFAULTS };
function setEnv(envObj = {}) {
  _env = { ...DEFAULTS, ...envObj };
}
function getEnv() {
  return _env;
}
var ENGINE_KEY_MAP = {
  tavily: "TAVILY_API_KEY",
  serpapi: "SERPAPI_API_KEY",
  serper: "SERPER_API_KEY",
  search1api: "SEARCH1API_KEY",
  jina: "JINA_API_KEY",
  baidu: "BAIDU_API_KEY"
};
function getEnabledEngines() {
  const env = getEnv();
  const raw = env.SEARCH_CONFIG;
  if (raw == null) return [];
  let config;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      config = JSON.parse(trimmed);
    } catch (e) {
      console.error(
        "[env] SEARCH_CONFIG JSON parse error:",
        e.message
      );
      return [];
    }
  } else if (typeof raw === "object") {
    config = raw;
  } else {
    return [];
  }
  const entries = Object.entries(config).map(([name, priority]) => ({
    name: String(name).toLowerCase(),
    priority: Number(priority)
  })).filter((e) => {
    const keyName = ENGINE_KEY_MAP[e.name];
    return !!keyName && !!env[keyName] && // 已配置 key
    !Number.isNaN(e.priority);
  });
  entries.sort((a, b) => a.priority - b.priority);
  return entries.map((e) => e.name);
}

// src/auth.ts
function verifyToken(request, paramToken) {
  const { TOKEN } = getEnv();
  if (!TOKEN) return true;
  const headerToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const token = headerToken || paramToken;
  return token === TOKEN;
}
function unauthorizedResponse() {
  return new Response(
    JSON.stringify({
      error: "Unauthorized",
      message: "Invalid or missing authentication token"
    }),
    {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    }
  );
}

// src/cors.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400"
};
function withCors(extra = {}) {
  return { ...CORS_HEADERS, ...extra };
}

// src/engines/_shared.ts
var normalizeResults = (results) => (Array.isArray(results) ? results : []).map((r) => ({
  title: r.title || r.name || "",
  url: r.url || r.link || r.href || "",
  description: r.description || r.content || r.snippet || r.summary || ""
}));

// src/engines/tavily.ts
var searchTavily = async ({ query, signal }) => {
  const { TAVILY_API_KEY } = getEnv();
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TAVILY_API_KEY}`
    },
    body: JSON.stringify({ query, search_depth: "advanced" }),
    signal
  });
  if (!res.ok) {
    console.error(`[tavily] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return normalizeResults(data.results);
};
var tavily_default = searchTavily;

// src/engines/serpapi.ts
var searchSerpapi = async ({ query, signal }) => {
  const { SERPAPI_API_KEY } = getEnv();
  const url = `https://serpapi.com/search?q=${encodeURIComponent(
    query
  )}&api_key=${encodeURIComponent(SERPAPI_API_KEY ?? "")}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    console.error(`[serpapi] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return normalizeResults(data.organic_results);
};
var serpapi_default = searchSerpapi;

// src/engines/serper.ts
var searchSerper = async ({ query, signal }) => {
  const { SERPER_API_KEY } = getEnv();
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_API_KEY ?? ""
    },
    body: JSON.stringify({ q: query }),
    signal
  });
  if (!res.ok) {
    console.error(`[serper] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return normalizeResults(data.organic);
};
var serper_default = searchSerper;

// src/engines/search1api.ts
var searchSearch1api = async ({ query, signal }) => {
  const { SEARCH1API_KEY } = getEnv();
  const res = await fetch("https://api.search1api.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SEARCH1API_KEY}`
    },
    body: JSON.stringify({
      query,
      search_service: "google",
      max_results: 10,
      crawl_results: 0,
      image: false,
      language: ""
    }),
    signal
  });
  if (!res.ok) {
    console.error(`[search1api] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  const results = data.results || data.organic || data.data || [];
  return normalizeResults(results);
};
var search1api_default = searchSearch1api;

// src/engines/jina.ts
var searchJina = async ({ query, signal }) => {
  const { JINA_API_KEY } = getEnv();
  const url = `https://s.jina.ai/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${JINA_API_KEY}`,
      "X-Respond-With": "no-content",
      Accept: "application/json"
    },
    signal
  });
  if (!res.ok) {
    console.error(`[jina] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return normalizeResults(data.data);
};
var jina_default = searchJina;

// src/engines/baidu.ts
var searchBaidu = async ({ query, signal }) => {
  const { BAIDU_API_KEY } = getEnv();
  const res = await fetch("https://qianfan.baidubce.com/v2/ai_search/web_search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BAIDU_API_KEY}`,
      "X-Appbuilder-From": "openclaw"
    },
    body: JSON.stringify({
      messages: [{ content: query, role: "user" }],
      search_source: "baidu_search_v2",
      resource_type_filter: [{ type: "web", top_k: 10 }],
      search_filter: {}
    }),
    signal
  });
  if (!res.ok) {
    console.error(`[baidu] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  if (data && typeof data === "object" && "code" in data) {
    console.error(`[baidu] code=${data.code} ${data.message || ""}`);
    return [];
  }
  return normalizeResults(data.references);
};
var baidu_default = searchBaidu;

// src/engines/index.ts
var ENGINES = {
  tavily: tavily_default,
  serpapi: serpapi_default,
  serper: serper_default,
  search1api: search1api_default,
  jina: jina_default,
  baidu: baidu_default
};

// src/search.ts
async function searchSingle(engineName, query, timeout) {
  const fn = ENGINES[engineName];
  if (!fn) {
    console.warn(`[search] unknown engine: ${engineName}`);
    return [];
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const results = await fn({ query, signal: controller.signal });
    clearTimeout(timer);
    return Array.isArray(results) ? results : [];
  } catch (e) {
    clearTimeout(timer);
    const err = e;
    if (err.name === "AbortError") {
      console.error(`[${engineName}] timeout after ${timeout}ms`);
    } else {
      console.error(`[${engineName}] ${err.message}`);
    }
    return [];
  }
}
async function searchWithFallback(query, enginesOverride) {
  const env = getEnv();
  const timeout = parseInt(env.DEFAULT_TIMEOUT || "8000", 10);
  const enabled = getEnabledEngines();
  const engines = enginesOverride && enginesOverride.length ? enginesOverride.map((n) => n.toLowerCase()).filter((n) => enabled.includes(n)) : enabled;
  const tried = [];
  for (const name of engines) {
    tried.push(name);
    const results = await searchSingle(name, query, timeout);
    if (results.length > 0) {
      return {
        query,
        number_of_results: results.length,
        engine_used: name,
        tried_engines: tried,
        engines_available: engines,
        results: results.map((r) => ({ ...r, engine: name }))
      };
    }
  }
  return {
    query,
    number_of_results: 0,
    engine_used: null,
    tried_engines: tried,
    engines_available: engines,
    results: []
  };
}

// src/wiki.ts
var WIKIPEDIA_LANGUAGES = {
  zh: "https://zh.wikipedia.org",
  en: "https://en.wikipedia.org",
  ja: "https://ja.wikipedia.org",
  ko: "https://ko.wikipedia.org",
  fr: "https://fr.wikipedia.org",
  de: "https://de.wikipedia.org",
  es: "https://es.wikipedia.org",
  ru: "https://ru.wikipedia.org",
  pt: "https://pt.wikipedia.org",
  it: "https://it.wikipedia.org"
};
var ZHWIKISOURCE_API = "https://zh.wikisource.org/w/api.php";
var ZHWIKISOURCE_PAGE = "https://zh.wikisource.org/wiki/";
function wikiHeaders(referer) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    Referer: referer,
    Accept: "application/json"
  };
}
function cleanSnippet(snippet) {
  return snippet.replace(/<span class="searchmatch">(.*?)<\/span>/g, "$1").replace(/<[^>]+>/g, "").trim();
}
async function mediawikiSearch(apiUrl, pageBaseUrl, referer, query, limit, searchType, signal) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    srlimit: String(Math.min(limit, 50)),
    srwhat: searchType,
    utf8: "1"
  });
  const res = await fetch(`${apiUrl}?${params.toString()}`, {
    headers: wikiHeaders(referer),
    signal
  });
  if (!res.ok) {
    console.error(`[wiki] MediaWiki HTTP ${res.status}`);
    throw new Error(`MediaWiki API HTTP ${res.status}`);
  }
  const data = await res.json();
  const q = data.query || {};
  const searchInfo = q.searchinfo || {};
  const totalHits = Number(searchInfo.totalhits) || 0;
  const items = Array.isArray(q.search) ? q.search : [];
  const results = items.map((item) => {
    const title = item.title || "";
    return {
      title,
      url: pageBaseUrl + encodeURIComponent(title.replace(/ /g, "_")),
      snippet: cleanSnippet(item.snippet || ""),
      size: item.size || 0,
      word_count: item.wordcount || 0,
      timestamp: item.timestamp || ""
    };
  });
  return { results, totalHits };
}
async function searchWiki(params) {
  const source = params.source || "wikipedia";
  const language = (params.language || "zh").toLowerCase();
  const limit = params.limit ?? 20;
  const searchType = params.search_type || "text";
  const query = (params.query || "").trim();
  if (!query) throw new Error("query \u4E0D\u80FD\u4E3A\u7A7A");
  if (limit < 1 || limit > 50) throw new Error("limit \u5FC5\u987B\u5728 1-50 \u4E4B\u95F4");
  if (searchType !== "text" && searchType !== "title")
    throw new Error("search_type \u5FC5\u987B\u662F text \u6216 title");
  let apiUrl;
  let pageBaseUrl;
  let referer;
  let langOut;
  let sourceLabel;
  if (source === "wikisource") {
    apiUrl = ZHWIKISOURCE_API;
    pageBaseUrl = ZHWIKISOURCE_PAGE;
    referer = "https://zh.wikisource.org/";
    langOut = "zh";
    sourceLabel = "zh.wikisource.org";
  } else {
    if (!(language in WIKIPEDIA_LANGUAGES)) {
      throw new Error(
        `\u4E0D\u652F\u6301\u7684\u8BED\u8A00 '${language}',\u652F\u6301: ${Object.keys(WIKIPEDIA_LANGUAGES).join(", ")}`
      );
    }
    const base = WIKIPEDIA_LANGUAGES[language];
    apiUrl = `${base}/w/api.php`;
    pageBaseUrl = `${base}/wiki/`;
    referer = `${base}/`;
    langOut = language;
    sourceLabel = `${langOut}.wikipedia.org`;
  }
  const timeout = parseInt(getEnv().DEFAULT_TIMEOUT || "8000", 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const { results, totalHits } = await mediawikiSearch(
      apiUrl,
      pageBaseUrl,
      referer,
      query,
      limit,
      searchType,
      controller.signal
    );
    return {
      query,
      source,
      language: langOut,
      total_hits: totalHits,
      number_of_results: results.length,
      results
    };
  } catch (e) {
    const err = e;
    if (err.name === "AbortError") {
      throw new Error(`wiki search timeout after ${timeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// src/web.ts
function getSearchHtml(opts) {
  const { tokenEnabled, engines } = opts;
  const enginesReady = engines.length > 0;
  const statusTone = enginesReady && tokenEnabled ? "border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10" : "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10";
  const enginePills = engines.length ? engines.map(
    (name, i) => `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"><span class="opacity-60">${i + 1}</span>${name}</span>`
  ).join("") : '<span class="text-sm text-amber-600 dark:text-amber-400">\u672A\u542F\u7528\u4EFB\u4F55\u5F15\u64CE \u2014 \u8BF7\u914D\u7F6E SEARCH_CONFIG \u4E0E\u5BF9\u5E94 API key</span>';
  return `<!DOCTYPE html>
<html lang="zh-CN" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cf-search-mcp \xB7 \u591A\u5F15\u64CE\u964D\u7EA7\u641C\u7D22</title>
  <meta name="description" content="\u57FA\u4E8E Cloudflare Workers \u7684\u591A\u5F15\u64CE\u964D\u7EA7\u641C\u7D22\u670D\u52A1">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>\u{1F50D}</text></svg>">
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

        <!-- \u6807\u9898\u533A -->
        <div>
          <div class="text-5xl mb-4">\u{1F50D}</div>
          <h1 class="text-3xl font-bold tracking-tight text-zinc-800 sm:text-4xl dark:text-zinc-100">cf-search-mcp</h1>
          <p class="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            \u57FA\u4E8E Cloudflare Workers \u7684\u591A\u5F15\u64CE\u964D\u7EA7\u641C\u7D22\u670D\u52A1\u3002\u6309\u6743\u91CD\u4F9D\u6B21\u5C1D\u8BD5 tavily / serpapi / serper / search1api / jina / baidu,\u9996\u4E2A\u6709\u7ED3\u679C\u5373\u8FD4\u56DE\u3002
          </p>
        </div>

        <!-- \u670D\u52A1\u72B6\u6001 -->
        <div class="mt-8 rounded-2xl border ${statusTone} p-6">
          <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">\u2699\uFE0F \u670D\u52A1\u72B6\u6001</h2>
          <div class="space-y-2 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-zinc-700 dark:text-zinc-300">\u542F\u7528\u5F15\u64CE(\u6309\u964D\u7EA7\u987A\u5E8F)</span>
              <span class="${enginesReady ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}">${enginesReady ? "\u2713 \u5DF2\u914D\u7F6E" : "\u25CB \u672A\u914D\u7F6E"}</span>
            </div>
            <div class="flex flex-wrap gap-2 pt-1">${enginePills}</div>
            <div class="flex items-center justify-between pt-2">
              <span class="text-zinc-700 dark:text-zinc-300">\u8BBF\u95EE\u9274\u6743(TOKEN)</span>
              <span class="${tokenEnabled ? "text-green-600 dark:text-green-400" : "text-zinc-500 dark:text-zinc-500"}">${tokenEnabled ? "\u2713 \u5DF2\u542F\u7528" : "\u25CB \u672A\u542F\u7528(\u516C\u5F00\u8BBF\u95EE)"}</span>
            </div>
          </div>
        </div>

        <!-- \u641C\u7D22\u8868\u5355 -->
        <div class="mt-8 rounded-2xl border border-zinc-100 p-6 dark:border-zinc-700/40">
          <form id="searchForm" class="space-y-4">
            <div>
              <label for="searchQuery" class="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">\u641C\u7D22\u5173\u952E\u8BCD</label>
              <input type="text" id="searchQuery" placeholder="\u8F93\u5165\u60A8\u8981\u641C\u7D22\u7684\u5185\u5BB9..." required class="w-full rounded-md bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:placeholder:text-zinc-500">
            </div>
            <button type="submit" id="searchBtn" class="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 dark:bg-blue-500 dark:hover:bg-blue-400">\u5F00\u59CB\u641C\u7D22</button>
          </form>
        </div>

        <!-- \u7ED3\u679C\u533A -->
        <div id="resultsSection" class="mt-8 hidden">
          <div class="rounded-2xl border border-zinc-100 p-6 dark:border-zinc-700/40">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">\u641C\u7D22\u7ED3\u679C <span id="resultCount" class="text-sm font-normal text-zinc-500"></span></h2>
              <button id="clearBtn" class="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">\u6E05\u9664</button>
            </div>
            <div id="resultMeta" class="text-xs text-zinc-500 dark:text-zinc-400 mb-4"></div>
            <div id="results" class="space-y-3"></div>
          </div>
        </div>

        <!-- API \u8BF4\u660E -->
        <div class="mt-8 rounded-2xl border border-zinc-100 p-6 dark:border-zinc-700/40">
          <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">\u{1F4D6} API \u7528\u6CD5</h2>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-3">\u9664\u7F51\u9875\u754C\u9762\u5916,\u4E5F\u53EF\u76F4\u63A5 HTTP \u8C03\u7528(\u652F\u6301 GET / POST)\u3002</p>
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
            \u53C2\u6570:<code class="px-1 bg-zinc-100 dark:bg-zinc-800 rounded">q</code> \u5173\u952E\u8BCD(\u5FC5\u586B)\u3001<code class="px-1 bg-zinc-100 dark:bg-zinc-800 rounded">engines</code> \u5F15\u64CE\u5B50\u96C6(\u53EF\u9009)${tokenEnabled ? '\u3001<code class="px-1 bg-zinc-100 dark:bg-zinc-800 rounded">token</code> \u8BBF\u95EE\u4EE4\u724C(\u5FC5\u586B)' : ""}
          </div>
        </div>

        <!-- \u9875\u811A -->
        <footer class="mt-16 mb-16 border-t border-zinc-100 pt-8 dark:border-zinc-700/40">
          <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p class="text-sm text-zinc-400 dark:text-zinc-500">Powered by Cloudflare Workers</p>
            <a href="https://github.com/ferocknew/cf-search-mcp" target="_blank" class="text-sm font-medium text-zinc-800 hover:text-blue-500 dark:text-zinc-200 dark:hover:text-blue-400">GitHub \u2192</a>
          </div>
        </footer>

      </div>
    </div>
  </main>

  <!-- Token \u6A21\u6001\u5F39\u6846(\u4EC5 TOKEN_ENABLED \u65F6\u7531 JS \u663E\u793A) -->
  <div id="tokenModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
      <h3 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">\u{1F512} \u8BF7\u8F93\u5165\u8BBF\u95EE\u4EE4\u724C</h3>
      <p id="tokenModalHint" class="text-xs text-zinc-500 dark:text-zinc-400 mb-4">\u672C\u670D\u52A1\u5DF2\u542F\u7528\u8BBF\u95EE\u9274\u6743,\u8BF7\u8F93\u5165 TOKEN \u540E\u4F7F\u7528\u3002</p>
      <input type="password" id="tokenInput" placeholder="\u8F93\u5165 Token..." class="w-full rounded-md bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 mb-3">
      <button id="tokenSubmit" class="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-blue-500 dark:hover:bg-blue-400">\u786E\u8BA4</button>
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

      // \u521D\u59CB\u5316:\u542F\u7528\u9274\u6743\u4E14\u672C\u5730\u65E0 token \u2192 \u5F39\u6846
      if (TOKEN_ENABLED && !getToken()) {
        openTokenModal("\u672C\u670D\u52A1\u5DF2\u542F\u7528\u8BBF\u95EE\u9274\u6743,\u8BF7\u8F93\u5165 TOKEN \u540E\u4F7F\u7528\u3002");
      }

      function refreshApiExamples() {
        var t = getToken();
        var tok = TOKEN_ENABLED && t ? "&token=" + encodeURIComponent(t) : "";
        $("apiExample1").textContent = origin + "/search?q=cloudflare" + tok;
        $("apiExample2").textContent = 'curl -X POST "' + origin + '/search" -d "q=cloudflare' + tok + '"';
      }
      refreshApiExamples();

      // \u641C\u7D22\u63D0\u4EA4
      $("searchForm").addEventListener("submit", async function (e) {
        e.preventDefault();
        var query = $("searchQuery").value.trim();
        if (!query) return;
        if (TOKEN_ENABLED && !getToken()) { openTokenModal("\u8BF7\u5148\u8F93\u5165 TOKEN \u518D\u641C\u7D22\u3002"); return; }

        var btn = $("searchBtn");
        var orig = btn.textContent;
        btn.textContent = "\u641C\u7D22\u4E2D...";
        btn.disabled = true;
        try {
          var url = origin + "/search?q=" + encodeURIComponent(query);
          var t = getToken();
          if (TOKEN_ENABLED && t) url += "&token=" + encodeURIComponent(t);
          var res = await fetch(url);
          if (res.status === 401) {
            localStorage.removeItem(STORAGE_KEY);
            openTokenModal("Token \u65E0\u6548\u6216\u5DF2\u8FC7\u671F,\u8BF7\u91CD\u65B0\u8F93\u5165\u3002");
            return;
          }
          var data = await res.json();
          displayResults(data);
          refreshApiExamples();
        } catch (err) {
          alert("\u641C\u7D22\u5931\u8D25: " + err.message);
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
        count.textContent = "(\u5171 " + (data.number_of_results || 0) + " \u6761)";
        var tried = Array.isArray(data.tried_engines) ? data.tried_engines : [];
        meta.innerHTML = '\u547D\u4E2D\u5F15\u64CE:<span class="font-medium text-zinc-700 dark:text-zinc-300">' + escapeHtml(data.engine_used || "\u65E0") + '</span>' + (tried.length ? " \xB7 \u5C1D\u8BD5\u987A\u5E8F:" + tried.map(escapeHtml).join(" \u2192 ") : "");

        if (data.results && data.results.length) {
          list.innerHTML = data.results.map(function (r) {
            return '<div class="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">' +
              '<div class="flex items-start justify-between gap-3">' +
                '<div class="flex-1 min-w-0">' +
                  '<a href="' + escapeHtml(r.url) + '" target="_blank" class="text-base font-medium text-blue-600 dark:text-blue-400 hover:underline break-all">' + escapeHtml(r.title || "\u65E0\u6807\u9898") + '</a>' +
                  '<p class="text-xs text-zinc-500 dark:text-zinc-500 mt-1 break-all">' + escapeHtml(r.url) + '</p>' +
                  '<p class="text-sm text-zinc-700 dark:text-zinc-300 mt-2">' + escapeHtml(r.description || "\u6682\u65E0\u63CF\u8FF0") + '</p>' +
                '</div>' +
                (r.engine ? '<span class="shrink-0 text-xs text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded">' + escapeHtml(r.engine) + '</span>' : "") +
              '</div>' +
            '</div>';
          }).join("");
        } else {
          list.innerHTML = '<p class="text-center text-zinc-500 dark:text-zinc-400 py-4">\u6CA1\u6709\u627E\u5230\u76F8\u5173\u7ED3\u679C</p>';
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

// src/mcp/tools.ts
var ALL_ENGINES = ["tavily", "serpapi", "serper", "search1api", "jina", "baidu"];
function searchInputSchema() {
  return {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query string"
      },
      engines: {
        type: "array",
        items: { type: "string", enum: ALL_ENGINES },
        description: "Optional: engine subset to use (fallback order still applies within the subset). Available: tavily, serpapi, serper, search1api, jina, baidu"
      }
    },
    required: ["query"]
  };
}
var SEARCH_DESCRIPTION = "Search the web for current information across multiple engines (tavily / serpapi / serper / search1api / jina / baidu, fallback by configured priority). Returns results with title, description, url and the source engine that produced them. Use this when you need real-time information beyond your training data.";
function wikiInputSchema() {
  return {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query string"
      },
      language: {
        type: "string",
        enum: ["zh", "en", "ja", "ko", "fr", "de", "es", "ru", "pt", "it"],
        description: "Language code (default zh)"
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Number of results, 1-50 (default 20)"
      },
      search_type: {
        type: "string",
        enum: ["text", "title"],
        description: "text=full-text search, title=title-only (default text)"
      }
    },
    required: ["query"]
  };
}
function wikisourceInputSchema() {
  return {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query string"
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Number of results, 1-50 (default 20)"
      },
      search_type: {
        type: "string",
        enum: ["text", "title"],
        description: "text=full-text search, title=title-only (default text)"
      }
    },
    required: ["query"]
  };
}
var WIKI_DESCRIPTION = "Search Wikipedia (MediaWiki API) across multiple languages (zh/en/ja/ko/fr/de/es/ru/pt/it, default zh). Returns title, url, snippet, size, word_count, timestamp. Use for encyclopedic knowledge.";
var WIKISOURCE_DESCRIPTION = "Search Chinese Wikisource (zh.wikisource.org, MediaWiki API) for source texts. Returns title, url, snippet, size, word_count, timestamp.";
var MCP_TOOLS = [
  {
    name: "search",
    description: SEARCH_DESCRIPTION,
    inputSchema: searchInputSchema()
  },
  {
    name: "wiki_search",
    description: WIKI_DESCRIPTION,
    inputSchema: wikiInputSchema()
  },
  {
    name: "wikisource_search",
    description: WIKISOURCE_DESCRIPTION,
    inputSchema: wikisourceInputSchema()
  }
];
async function callTool(name, args) {
  if (name === "wiki_search" || name === "wikisource_search") {
    return callWiki(name, args);
  }
  if (name !== "search") {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true
    };
  }
  const query = args?.query;
  if (typeof query !== "string" || !query.trim()) {
    return {
      content: [
        {
          type: "text",
          text: "Missing or invalid 'query' (non-empty string required)"
        }
      ],
      isError: true
    };
  }
  let engines;
  const rawEngines = args?.engines;
  if (Array.isArray(rawEngines)) {
    engines = rawEngines.filter((e) => typeof e === "string").map((e) => e.toLowerCase());
  }
  try {
    const result = await searchWithFallback(query, engines);
    const formatted = result.results.map(
      (item, i) => `${i + 1}. [${(item.engine || "?").toUpperCase()}] ${item.title}
   ${item.description}
   ${item.url}`
    ).join("\n\n");
    const summary = [
      `Search Query: "${result.query}"`,
      `Total Results: ${result.number_of_results}`,
      `Engine Used: ${result.engine_used || "none"}`,
      result.tried_engines.length > 0 ? `Tried Engines: ${result.tried_engines.join(", ")}` : null,
      result.engines_available.length > 0 ? `Engines Available: ${result.engines_available.join(", ")}` : null,
      "",
      "Results:",
      formatted || "(no results)"
    ].filter((line) => line !== null).join("\n");
    return { content: [{ type: "text", text: summary }] };
  } catch (e) {
    return {
      content: [{ type: "text", text: `Search failed: ${e.message}` }],
      isError: true
    };
  }
}
async function callWiki(name, args) {
  const query = args?.query;
  if (typeof query !== "string" || !query.trim()) {
    return {
      content: [
        {
          type: "text",
          text: "Missing or invalid 'query' (non-empty string required)"
        }
      ],
      isError: true
    };
  }
  const source = name === "wikisource_search" ? "wikisource" : "wikipedia";
  const limit = typeof args?.limit === "number" && args.limit > 0 ? args.limit : 20;
  const search_type = args?.search_type === "title" ? "title" : "text";
  const language = typeof args?.language === "string" ? args.language : "zh";
  try {
    const result = await searchWiki({
      query,
      source,
      language,
      limit,
      search_type
    });
    const formatted = result.results.map(
      (item, i) => `${i + 1}. ${item.title}
   ${item.snippet}
   ${item.url}`
    ).join("\n\n");
    const summary = [
      `Wiki Query: "${result.query}"`,
      `Source: ${result.source} (${result.language})`,
      `Total Hits: ${result.total_hits}`,
      `Results: ${result.number_of_results}`,
      "",
      "Results:",
      formatted || "(no results)"
    ].join("\n");
    return { content: [{ type: "text", text: summary }] };
  } catch (e) {
    return {
      content: [
        { type: "text", text: `Wiki search failed: ${e.message}` }
      ],
      isError: true
    };
  }
}

// src/mcp/types.ts
var RPC_ERROR = {
  PARSE_ERROR: { code: -32700, message: "Parse error" },
  INVALID_REQUEST: { code: -32600, message: "Invalid Request" },
  METHOD_NOT_FOUND: { code: -32601, message: "Method not found" },
  INVALID_PARAMS: { code: -32602, message: "Invalid params" },
  INTERNAL_ERROR: { code: -32603, message: "Internal error" }
};

// src/mcp/server.ts
var PROTOCOL_VERSION = "2025-03-26";
var SERVER_INFO = { name: "cf-search-mcp", version: "0.1.0" };
function rpcResponse(id, result) {
  const body = { jsonrpc: "2.0", id, result };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: withCors({ "Content-Type": "application/json; charset=utf-8" })
  });
}
function rpcError(id, code, message, status = 200) {
  const body = { jsonrpc: "2.0", id, error: { code, message } };
  return new Response(JSON.stringify(body), {
    status,
    headers: withCors({ "Content-Type": "application/json; charset=utf-8" })
  });
}
function accepted() {
  return new Response(null, { status: 202, headers: withCors() });
}
async function handleMcpRequest(request) {
  if (!verifyToken(request)) {
    return unauthorizedResponse();
  }
  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: withCors({ Allow: "POST" })
    });
  }
  let req;
  try {
    req = await request.json();
  } catch {
    return rpcError(null, RPC_ERROR.PARSE_ERROR.code, RPC_ERROR.PARSE_ERROR.message);
  }
  const method = req.method;
  const params = req.params || {};
  if (req.id === void 0 || req.id === null) {
    return accepted();
  }
  const id = req.id;
  switch (method) {
    case "initialize":
      return rpcResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO
      });
    case "notifications/initialized":
      return accepted();
    case "ping":
      return rpcResponse(id, {});
    case "tools/list":
      return rpcResponse(id, { tools: MCP_TOOLS });
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const rawArgs = params.arguments;
      const args = rawArgs && typeof rawArgs === "object" ? rawArgs : void 0;
      const result = await callTool(name, args);
      return rpcResponse(id, result);
    }
    default:
      return rpcError(
        id,
        RPC_ERROR.METHOD_NOT_FOUND.code,
        RPC_ERROR.METHOD_NOT_FOUND.message
      );
  }
}

// src/index.ts
function jsonResponse(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: withCors({
      "Content-Type": "application/json; charset=utf-8",
      ...extra
    })
  });
}
async function parseParams(request) {
  if (request.method === "POST") {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        return await request.json();
      } catch {
        return {};
      }
    }
    try {
      const fd = await request.formData();
      return Object.fromEntries(fd.entries());
    } catch {
      return {};
    }
  }
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
}
var PROTECTED_PATHS = /* @__PURE__ */ new Set(["/search", "/wiki", "/fetch"]);
async function handleRequest(request) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (url.pathname === "/") {
    const html = getSearchHtml({
      tokenEnabled: !!getEnv().TOKEN,
      engines: getEnabledEngines()
    });
    return new Response(html, {
      headers: withCors({ "Content-Type": "text/html; charset=utf-8" })
    });
  }
  if (url.pathname === "/mcp") {
    return handleMcpRequest(request);
  }
  if (!PROTECTED_PATHS.has(url.pathname)) {
    return jsonResponse({ error: "Not Found", path: url.pathname }, 404);
  }
  const params = await parseParams(request);
  if (!verifyToken(request, params.token)) {
    return unauthorizedResponse();
  }
  if (url.pathname === "/search") {
    const query = params.q || params.query;
    if (!query) {
      return jsonResponse(
        {
          error: "Missing query",
          message: "please provide 'q' or 'query' parameter"
        },
        400
      );
    }
    const engines = params.engines ? String(params.engines).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : void 0;
    try {
      const result = await searchWithFallback(query, engines);
      return jsonResponse(result);
    } catch (e) {
      console.error("[/search] error:", e);
      return jsonResponse(
        { error: "Internal server error", message: e.message },
        500
      );
    }
  }
  if (url.pathname === "/wiki") {
    const query = params.q || params.query;
    if (!query) {
      return jsonResponse(
        {
          error: "Missing query",
          message: "please provide 'q' or 'query' parameter"
        },
        400
      );
    }
    const source = params.source === "wikisource" ? "wikisource" : "wikipedia";
    const limit = params.limit ? parseInt(params.limit, 10) : 20;
    const search_type = params.search_type === "title" ? "title" : "text";
    const language = params.language || "zh";
    try {
      const result = await searchWiki({
        query,
        source,
        language,
        limit,
        search_type
      });
      return jsonResponse(result);
    } catch (e) {
      console.error("[/wiki] error:", e);
      return jsonResponse(
        { error: "Wiki search failed", message: e.message },
        400
      );
    }
  }
  return jsonResponse({
    ok: true,
    path: url.pathname,
    message: `endpoint ${url.pathname} active (logic comes in later milestone)`,
    received: params
  });
}
var index_default = {
  async fetch(request, envObj) {
    setEnv(envObj);
    return handleRequest(request);
  }
};
export {
  index_default as default
};
