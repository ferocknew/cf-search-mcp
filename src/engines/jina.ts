import { normalizeResults } from "./_shared";
import { getEnv } from "../env";
import type { SearchEngine } from "../types";

// Jina: GET https://s.jina.ai/?q=
// 认证 Authorization: Bearer,X-Respond-With: no-content(只返回搜索结果摘要,不抓正文)
// 用 Accept: application/json 拿结构化结果,响应 data[].{title,url,content}
const searchJina: SearchEngine = async ({ query, signal }) => {
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
  const data = (await res.json()) as Record<string, unknown>;
  return normalizeResults(data.data);
};

export default searchJina;
