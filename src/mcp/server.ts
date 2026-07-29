import { verifyToken, unauthorizedResponse } from "../auth";
import { withCors } from "../cors";
import { MCP_TOOLS, callTool } from "./tools";
import { RPC_ERROR } from "./types";
import type { JsonRpcRequest, JsonRpcResponse } from "./types";

// MCP Streamable HTTP(无状态实现):POST → application/json 的 JSON-RPC 响应,无 SSE / 无 session
// 参考 spec:stateless POST 返单条 JSON-RPC 响应是允许且 canonical 的形态

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "cf-search-mcp", version: "0.1.0" };

// 成功的 JSON-RPC 响应(200, application/json)
function rpcResponse(id: string | number | null, result: unknown): Response {
  const body: JsonRpcResponse = { jsonrpc: "2.0", id, result };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: withCors({ "Content-Type": "application/json; charset=utf-8" }),
  });
}

// JSON-RPC 错误响应(HTTP 200 携带 error,符合 JSON-RPC 约定;鉴权失败才用 401)
function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  status = 200
): Response {
  const body: JsonRpcResponse = { jsonrpc: "2.0", id, error: { code, message } };
  return new Response(JSON.stringify(body), {
    status,
    headers: withCors({ "Content-Type": "application/json; charset=utf-8" }),
  });
}

// 通知:202 无 body(无 id 的请求不应返回 JSON-RPC response)
function accepted(): Response {
  return new Response(null, { status: 202, headers: withCors() });
}

// MCP 端点主处理器
export async function handleMcpRequest(request: Request): Promise<Response> {
  // 鉴权:Authorization: Bearer(verifyToken 读 header)
  if (!verifyToken(request)) {
    return unauthorizedResponse();
  }

  // 无状态 Streamable HTTP:仅接受 POST,GET 等返 405
  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: withCors({ Allow: "POST" }),
    });
  }

  // 解析 JSON-RPC body
  let req: JsonRpcRequest;
  try {
    req = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, RPC_ERROR.PARSE_ERROR.code, RPC_ERROR.PARSE_ERROR.message);
  }

  const method = req.method;
  const params = (req.params || {}) as Record<string, unknown>;

  // 无 id → 通知(如 initialize 之后的 notifications/initialized):202 无 body
  if (req.id === undefined || req.id === null) {
    return accepted();
  }
  const id = req.id;

  switch (method) {
    case "initialize":
      return rpcResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
      // 带了 id 的回执(罕见),按通知处理
      return accepted();

    case "ping":
      return rpcResponse(id, {});

    case "tools/list":
      return rpcResponse(id, { tools: MCP_TOOLS });

    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const rawArgs = params.arguments;
      const args =
        rawArgs && typeof rawArgs === "object"
          ? (rawArgs as Record<string, unknown>)
          : undefined;
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
