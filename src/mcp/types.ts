// JSON-RPC 2.0 与 MCP 类型定义

// JSON-RPC 请求(id 可选:通知无 id)
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

// JSON-RPC 错误对象
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// JSON-RPC 响应(result 与 error 互斥)
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

// MCP 工具定义(tools/list 返回项)
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// MCP tools/call 返回的内容项
export interface McpContent {
  type: "text";
  text: string;
}

// MCP tools/call 返回结构
export interface McpCallResult {
  content: McpContent[];
  isError?: boolean;
}

// 标准 JSON-RPC 错误码(spec 预定义)
export const RPC_ERROR = {
  PARSE_ERROR: { code: -32700, message: "Parse error" },
  INVALID_REQUEST: { code: -32600, message: "Invalid Request" },
  METHOD_NOT_FOUND: { code: -32601, message: "Method not found" },
  INVALID_PARAMS: { code: -32602, message: "Invalid params" },
  INTERNAL_ERROR: { code: -32603, message: "Internal error" },
} as const;
