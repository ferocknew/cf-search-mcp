import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import { getEnv } from "./env";
import type {
  WebFetchFormat,
  WebFetchParams,
  WebFetchResponse,
} from "./types";

// 网页抓取(M3):readability 阅读模式提取正文 + turndown 转 markdown;html_raw 返回原始 HTML
// 参考 mcp_searxng_python 的 url_reader(其仅做 plaintext,本项目扩展到 4 格式并用 readability)

// 浏览器级请求头(反爬虫),参考项目 raw_html 的完整头集合
const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

// Readability 原生依赖 DOM Document 类型,本项目无 DOM lib(仅 workers-types)
// 这里把构造函数断言成不引用 Document 的签名;运行时 linkedom 的 document 满足其 DOM API 需求
interface ReadabilityArticle {
  title: string;
  content: string; // 提取出的正文 HTML
  textContent: string;
  length: number;
  excerpt?: string;
  siteName?: string;
  byline?: string | null;
  dir?: string | null;
}
type ReadabilityCtor = new (doc: unknown) => {
  parse(): ReadabilityArticle | null;
};
const ReadabilityReader = Readability as unknown as ReadabilityCtor;

// 从原始 HTML 提取 <title>(readability 解析失败时兜底)
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : "";
}

export async function fetchUrl(
  params: WebFetchParams
): Promise<WebFetchResponse> {
  const format: WebFetchFormat = params.format || "txt";
  const url = (params.url || "").trim();

  // 校验
  if (!url) throw new Error("url 不能为空");
  if (!/^https?:\/\//i.test(url))
    throw new Error("url 必须以 http:// 或 https:// 开头");
  if (!["txt", "markdown", "html_body", "html_raw"].includes(format))
    throw new Error("format 必须是 txt / markdown / html_body / html_raw");

  const timeout = parseInt(getEnv().DEFAULT_TIMEOUT || "8000", 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const err = e as Error;
    if (err.name === "AbortError") {
      throw new Error(`fetch timeout after ${timeout}ms`);
    }
    throw new Error(`fetch failed: ${err.message}`);
  }

  try {
    if (!res.ok) {
      throw new Error(`fetch HTTP ${res.status}`);
    }
    const html = await res.text();
    const finalUrl = res.url || url;

    // html_raw:原始 HTML,不做阅读模式处理
    if (format === "html_raw") {
      return {
        url,
        final_url: finalUrl,
        format,
        status: res.status,
        title: extractTitle(html),
        content: html,
        content_length: html.length,
      };
    }

    // 其他格式:linkedom 解析 → readability 提取正文
    const { document } = parseHTML(html);
    const article = new ReadabilityReader(document).parse();

    const title = article?.title || extractTitle(html);

    if (format === "html_body") {
      const content = article?.content || "";
      return {
        url,
        final_url: finalUrl,
        format,
        status: res.status,
        title,
        content,
        content_length: content.length,
      };
    }

    if (format === "markdown") {
      const sourceHtml = article?.content || "";
      const td = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        bulletListMarker: "-",
      });
      const md = sourceHtml ? td.turndown(sourceHtml) : "";
      return {
        url,
        final_url: finalUrl,
        format,
        status: res.status,
        title,
        content: md,
        content_length: md.length,
      };
    }

    // txt:readability 提取的纯文本
    const content = article?.textContent || "";
    return {
      url,
      final_url: finalUrl,
      format,
      status: res.status,
      title,
      content,
      content_length: content.length,
    };
  } finally {
    // res.text() 已完成,这里清 timer(避免大正文转 markdown 时仍占用超时)
    clearTimeout(timer);
  }
}
