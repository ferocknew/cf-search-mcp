import { getEnv } from "./env.js";

// Token 鉴权
// 未配置 TOKEN 时跳过鉴权(开放访问);配置后需通过 Authorization: Bearer 或 query 参数 ?token= 提供
export function verifyToken(request, paramToken) {
  const { TOKEN } = getEnv();
  if (!TOKEN) return true;

  const headerToken = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");
  const token = headerToken || paramToken;

  return token === TOKEN;
}

// 生成 401 响应
export function unauthorizedResponse() {
  return new Response(
    JSON.stringify({
      error: "Unauthorized",
      message: "Invalid or missing authentication token",
    }),
    {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }
  );
}
