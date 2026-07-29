import { setEnv, getEnv, getEnabledEngines } from "./env";
import { verifyToken, unauthorizedResponse } from "./auth";
import { CORS_HEADERS, withCors } from "./cors";
import { searchWithFallback } from "./search";
import { searchWiki } from "./wiki";
import { getSearchHtml } from "./web";
import { handleMcpRequest } from "./mcp/server";
import type { Env, WikiSource, WikiSearchType } from "./types";

// 统一 JSON 响应(带 CORS)
function jsonResponse(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: withCors({
      "Content-Type": "application/json; charset=utf-8",
      ...extra,
    }),
  });
}

// 解析请求参数(GET query 或 POST form/json)
async function parseParams(
  request: Request
): Promise<Record<string, string>> {
  if (request.method === "POST") {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        return (await request.json()) as Record<string, string>;
      } catch {
        return {};
      }
    }
    try {
      const fd = await request.formData();
      return Object.fromEntries(fd.entries()) as Record<string, string>;
    } catch {
      return {};
    }
  }
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries()) as Record<string, string>;
}

// 需鉴权的业务路由(/mcp 单独处理,不在此集合)
const PROTECTED_PATHS = new Set(["/search", "/wiki", "/fetch"]);

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 根路径:Web 界面(注入 TOKEN 是否启用 + 启用引擎列表,token 值不入 HTML)
  if (url.pathname === "/") {
    const html = getSearchHtml({
      tokenEnabled: !!getEnv().TOKEN,
      engines: getEnabledEngines(),
    });
    return new Response(html, {
      headers: withCors({ "Content-Type": "text/html; charset=utf-8" }),
    });
  }

  // /mcp:MCP Streamable HTTP 端点(单独处理:Bearer header 鉴权 + JSON-RPC body,不走通用 parseParams)
  if (url.pathname === "/mcp") {
    return handleMcpRequest(request);
  }

  // 非业务路由 → 404
  if (!PROTECTED_PATHS.has(url.pathname)) {
    return jsonResponse({ error: "Not Found", path: url.pathname }, 404);
  }

  // 业务路由:解析参数 + 鉴权
  const params = await parseParams(request);
  if (!verifyToken(request, params.token)) {
    return unauthorizedResponse();
  }

  // /search:主搜索降级链(M1)
  if (url.pathname === "/search") {
    const query = params.q || params.query;
    if (!query) {
      return jsonResponse(
        {
          error: "Missing query",
          message: "please provide 'q' or 'query' parameter",
        },
        400
      );
    }
    const engines = params.engines
      ? String(params.engines)
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : undefined;
    try {
      const result = await searchWithFallback(query, engines);
      return jsonResponse(result);
    } catch (e) {
      console.error("[/search] error:", e);
      return jsonResponse(
        { error: "Internal server error", message: (e as Error).message },
        500
      );
    }
  }

  // /wiki:百科搜索(M2,wikipedia/wikisource 独立工具,不参与主降级链)
  if (url.pathname === "/wiki") {
    const query = params.q || params.query;
    if (!query) {
      return jsonResponse(
        {
          error: "Missing query",
          message: "please provide 'q' or 'query' parameter",
        },
        400
      );
    }
    const source: WikiSource =
      params.source === "wikisource" ? "wikisource" : "wikipedia";
    const limit = params.limit ? parseInt(params.limit, 10) : 20;
    const search_type: WikiSearchType =
      params.search_type === "title" ? "title" : "text";
    const language = params.language || "zh";
    try {
      const result = await searchWiki({
        query,
        source,
        language,
        limit,
        search_type,
      });
      return jsonResponse(result);
    } catch (e) {
      console.error("[/wiki] error:", e);
      return jsonResponse(
        { error: "Wiki search failed", message: (e as Error).message },
        400
      );
    }
  }

  // /fetch:占位(M3 网页抓取待实现)
  return jsonResponse({
    ok: true,
    path: url.pathname,
    message: `endpoint ${url.pathname} active (logic comes in later milestone)`,
    received: params,
  });
}

export default {
  async fetch(request: Request, envObj: Env): Promise<Response> {
    setEnv(envObj);
    return handleRequest(request);
  },
};
