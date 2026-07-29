// 搜索结果归一化:各引擎字段不一,统一为 {title, url, description}
export const normalizeResults = (results) =>
  (Array.isArray(results) ? results : []).map((r) => ({
    title: r.title || r.name || "",
    url: r.url || r.link || r.href || "",
    description:
      r.description || r.content || r.snippet || r.summary || "",
  }));
