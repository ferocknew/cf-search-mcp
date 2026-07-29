import { getEnv } from "./env";
import type {
  WikiSearchParams,
  WikiResultItem,
  WikiSearchResponse,
  WikiSource,
  WikiSearchType,
} from "./types";

// 百科搜索(M2):wikipedia / wikisource,均用 MediaWiki API,不参与主降级链
// 参考 mcp_searxng_python 的 search_from_wikipedia / search_from_zhwikisource

// Wikipedia 支持的语言及 API 基址
const WIKIPEDIA_LANGUAGES: Record<string, string> = {
  zh: "https://zh.wikipedia.org",
  en: "https://en.wikipedia.org",
  ja: "https://ja.wikipedia.org",
  ko: "https://ko.wikipedia.org",
  fr: "https://fr.wikipedia.org",
  de: "https://de.wikipedia.org",
  es: "https://es.wikipedia.org",
  ru: "https://ru.wikipedia.org",
  pt: "https://pt.wikipedia.org",
  it: "https://it.wikipedia.org",
};

// 中文维基文库(固定中文)
const ZHWIKISOURCE_API = "https://zh.wikisource.org/w/api.php";
const ZHWIKISOURCE_PAGE = "https://zh.wikisource.org/wiki/";

// Wikimedia 反滥用系统会拦截不合规 User-Agent(实测 403),用浏览器级 UA + Referer 规避
function wikiHeaders(referer: string): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    Referer: referer,
    Accept: "application/json",
  };
}

// 清理 snippet:去 <span class="searchmatch">...</span> 保留内容,再去其他 HTML 标签
function cleanSnippet(snippet: string): string {
  return snippet
    .replace(/<span class="searchmatch">(.*?)<\/span>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

// MediaWiki API 原始搜索项
interface MediaWikiSearchItem {
  title?: string;
  snippet?: string;
  size?: number;
  wordcount?: number;
  timestamp?: string;
}

// 调 MediaWiki API 并归一化为 WikiResultItem[]
async function mediawikiSearch(
  apiUrl: string,
  pageBaseUrl: string,
  referer: string,
  query: string,
  limit: number,
  searchType: WikiSearchType,
  signal: AbortSignal
): Promise<{ results: WikiResultItem[]; totalHits: number }> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    srlimit: String(Math.min(limit, 50)),
    srwhat: searchType,
    utf8: "1",
  });
  const res = await fetch(`${apiUrl}?${params.toString()}`, {
    headers: wikiHeaders(referer),
    signal,
  });
  if (!res.ok) {
    console.error(`[wiki] MediaWiki HTTP ${res.status}`);
    throw new Error(`MediaWiki API HTTP ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const q = (data.query as Record<string, unknown>) || {};
  const searchInfo = (q.searchinfo as Record<string, unknown>) || {};
  const totalHits = Number(searchInfo.totalhits) || 0;
  const items = Array.isArray(q.search) ? (q.search as MediaWikiSearchItem[]) : [];
  const results: WikiResultItem[] = items.map((item) => {
    const title = item.title || "";
    return {
      title,
      url: pageBaseUrl + encodeURIComponent(title.replace(/ /g, "_")),
      snippet: cleanSnippet(item.snippet || ""),
      size: item.size || 0,
      word_count: item.wordcount || 0,
      timestamp: item.timestamp || "",
    };
  });
  return { results, totalHits };
}

// 百科搜索入口(wikipedia / wikisource)
export async function searchWiki(
  params: WikiSearchParams
): Promise<WikiSearchResponse> {
  const source: WikiSource = params.source || "wikipedia";
  const language = (params.language || "zh").toLowerCase();
  const limit = params.limit ?? 20;
  const searchType: WikiSearchType = params.search_type || "text";
  const query = (params.query || "").trim();

  // 参数校验
  if (!query) throw new Error("query 不能为空");
  if (limit < 1 || limit > 50) throw new Error("limit 必须在 1-50 之间");
  if (searchType !== "text" && searchType !== "title")
    throw new Error("search_type 必须是 text 或 title");

  let apiUrl: string;
  let pageBaseUrl: string;
  let referer: string;
  let langOut: string;
  let sourceLabel: string;

  if (source === "wikisource") {
    apiUrl = ZHWIKISOURCE_API;
    pageBaseUrl = ZHWIKISOURCE_PAGE;
    referer = "https://zh.wikisource.org/";
    langOut = "zh";
    sourceLabel = "zh.wikisource.org";
  } else {
    if (!(language in WIKIPEDIA_LANGUAGES)) {
      throw new Error(
        `不支持的语言 '${language}',支持: ${Object.keys(WIKIPEDIA_LANGUAGES).join(", ")}`
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
      results,
    };
  } catch (e) {
    const err = e as Error;
    if (err.name === "AbortError") {
      throw new Error(`wiki search timeout after ${timeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
