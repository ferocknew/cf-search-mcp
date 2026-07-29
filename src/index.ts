import { setEnv } from "./env";
import { verifyToken, unauthorizedResponse } from "./auth";
import { CORS_HEADERS, withCors } from "./cors";
import { searchWithFallback } from "./search";
import type { Env } from "./types";

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

// 需鉴权的业务路由
const PROTECTED_PATHS = new Set(["/search", "/wiki", "/fetch", "/mcp"]);

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 根路径:Web 界面(M4 实现,当前返回占位)
  if (url.pathname === "/") {
    return new Response(getPlaceholderHtml(), {
      headers: withCors({ "Content-Type": "text/html; charset=utf-8" }),
    });
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

  // /wiki /fetch /mcp:占位(后续里程碑填充)
  return jsonResponse({
    ok: true,
    path: url.pathname,
    message: `endpoint ${url.pathname} active (logic comes in later milestone)`,
    received: params,
  });
}

function getPlaceholderHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cf-search-mcp</title>
</head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px">
  <h1>cf-search-mcp</h1>
  <p>✅ Worker 已启动(M0 骨架)。</p>
  <p>Web 界面、搜索、百科、抓取、MCP 端点将在后续里程碑实现。</p>
  <ul>
    <li><code>GET /</code> — Web 界面</li>
    <li><code>GET/POST /search</code> — 多引擎降级搜索</li>
    <li><code>GET/POST /wiki</code> — 百科搜索</li>
    <li><code>GET/POST /fetch</code> — 网页抓取</li>
    <li><code>GET/POST /mcp</code> — MCP HTTP 端点</li>
  </ul>
</body>
</html>`;
}

export default {
  async fetch(request: Request, envObj: Env): Promise<Response> {
    setEnv(envObj);
    return handleRequest(request);
  },
};
