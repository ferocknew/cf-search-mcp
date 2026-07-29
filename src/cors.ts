// CORS 头与 preflight 处理

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

// 合并 CORS 头与其他响应头
export function withCors(
  extra: Record<string, string> = {}
): Record<string, string> {
  return { ...CORS_HEADERS, ...extra };
}
