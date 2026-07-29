import { normalizeResults } from "./_shared.js";
import { getEnv } from "../env.js";

// Baidu 千帆 AI 搜索: POST https://qianfan.baidubce.com/v2/ai_search/web_search
// 认证 Authorization: Bearer + X-Appbuilder-From: openclaw
// body {messages, search_source, resource_type_filter, search_filter}
// 响应 references[].{title,url,snippet,date,website};业务错误返回 {code, message}
export default async function searchBaidu({ query, signal }) {
  const { BAIDU_API_KEY } = getEnv();
  const res = await fetch(
    "https://qianfan.baidubce.com/v2/ai_search/web_search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BAIDU_API_KEY}`,
        "X-Appbuilder-From": "openclaw",
      },
      body: JSON.stringify({
        messages: [{ content: query, role: "user" }],
        search_source: "baidu_search_v2",
        resource_type_filter: [{ type: "web", top_k: 10 }],
        search_filter: {},
      }),
      signal,
    }
  );
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
}
