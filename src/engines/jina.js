import { normalizeResults } from "./_shared.js";
import { getEnv } from "../env.js";

// Jina: GET https://s.jina.ai/?q=
// 认证 Authorization: Bearer,X-Respond-With: no-content(只返回搜索结果摘要,不抓正文)
// 用 Accept: application/json 拿结构化结果,响应 data[].{title,url,content}
export default async function searchJina({ query, signal }) {
  const { JINA_API_KEY } = getEnv();
  const url = `https://s.jina.ai/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${JINA_API_KEY}`,
      "X-Respond-With": "no-content",
      Accept: "application/json",
    },
    signal,
  });
  if (!res.ok) {
    console.error(`[jina] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return normalizeResults(data.data);
}
