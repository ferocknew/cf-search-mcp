import { searchWithFallback } from "../search";
import { searchWiki } from "../wiki";
import type { McpTool, McpCallResult } from "./types";

// 全部引擎枚举(作文档提示;实际仍由 searchWithFallback 在「已启用且配 key」范围内降级)
const ALL_ENGINES = ["tavily", "serpapi", "serper", "search1api", "jina", "baidu"];

// 搜索工具输入 schema(query 必填,engines 可选子集)
function searchInputSchema(): McpTool["inputSchema"] {
  return {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query string",
      },
      engines: {
        type: "array",
        items: { type: "string", enum: ALL_ENGINES },
        description:
          "Optional: engine subset to use (fallback order still applies within the subset). " +
          "Available: tavily, serpapi, serper, search1api, jina, baidu",
      },
    },
    required: ["query"],
  };
}

const SEARCH_DESCRIPTION =
  "Search the web for current information across multiple engines " +
  "(tavily / serpapi / serper / search1api / jina / baidu, fallback by configured priority). " +
  "Returns results with title, description, url and the source engine that produced them. " +
  "Use this when you need real-time information beyond your training data.";

// Wikipedia 搜索工具输入 schema(query 必填,language/limit/search_type 可选)
function wikiInputSchema(): McpTool["inputSchema"] {
  return {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query string",
      },
      language: {
        type: "string",
        enum: ["zh", "en", "ja", "ko", "fr", "de", "es", "ru", "pt", "it"],
        description: "Language code (default zh)",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Number of results, 1-50 (default 20)",
      },
      search_type: {
        type: "string",
        enum: ["text", "title"],
        description: "text=full-text search, title=title-only (default text)",
      },
    },
    required: ["query"],
  };
}

// Wikisource 搜索工具输入 schema(固定中文,无 language 参数)
function wikisourceInputSchema(): McpTool["inputSchema"] {
  return {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query string",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Number of results, 1-50 (default 20)",
      },
      search_type: {
        type: "string",
        enum: ["text", "title"],
        description: "text=full-text search, title=title-only (default text)",
      },
    },
    required: ["query"],
  };
}

const WIKI_DESCRIPTION =
  "Search Wikipedia (MediaWiki API) across multiple languages " +
  "(zh/en/ja/ko/fr/de/es/ru/pt/it, default zh). " +
  "Returns title, url, snippet, size, word_count, timestamp. " +
  "Use for encyclopedic knowledge.";

const WIKISOURCE_DESCRIPTION =
  "Search Chinese Wikisource (zh.wikisource.org, MediaWiki API) for source texts. " +
  "Returns title, url, snippet, size, word_count, timestamp.";

// 工具列表:search + wiki_search + wikisource_search(README tools list 规定)
// pedia_search / web_fetch 待教育百科、M3 抓取实现后加入
export const MCP_TOOLS: McpTool[] = [
  {
    name: "search",
    description: SEARCH_DESCRIPTION,
    inputSchema: searchInputSchema(),
  },
  {
    name: "wiki_search",
    description: WIKI_DESCRIPTION,
    inputSchema: wikiInputSchema(),
  },
  {
    name: "wikisource_search",
    description: WIKISOURCE_DESCRIPTION,
    inputSchema: wikisourceInputSchema(),
  },
];

// 执行工具调用:校验参数 → 调降级搜索 → 格式化为 text(参考 Yrobot/cloudflare-search 的 mcp/cf-search-mcp.js)
export async function callTool(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<McpCallResult> {
  // 百科搜索(wikipedia / wikisource)
  if (name === "wiki_search" || name === "wikisource_search") {
    return callWiki(name, args);
  }

  if (name !== "search") {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  const query = args?.query;
  if (typeof query !== "string" || !query.trim()) {
    return {
      content: [
        {
          type: "text",
          text: "Missing or invalid 'query' (non-empty string required)",
        },
      ],
      isError: true,
    };
  }

  // engines 可选:仅保留字符串项并小写
  let engines: string[] | undefined;
  const rawEngines = args?.engines;
  if (Array.isArray(rawEngines)) {
    engines = rawEngines
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.toLowerCase());
  }

  try {
    const result = await searchWithFallback(query, engines);

    const formatted = result.results
      .map(
        (item, i) =>
          `${i + 1}. [${(item.engine || "?").toUpperCase()}] ${item.title}\n` +
          `   ${item.description}\n` +
          `   ${item.url}`
      )
      .join("\n\n");

    const summary = [
      `Search Query: "${result.query}"`,
      `Total Results: ${result.number_of_results}`,
      `Engine Used: ${result.engine_used || "none"}`,
      result.tried_engines.length > 0
        ? `Tried Engines: ${result.tried_engines.join(", ")}`
        : null,
      result.engines_available.length > 0
        ? `Engines Available: ${result.engines_available.join(", ")}`
        : null,
      "",
      "Results:",
      formatted || "(no results)",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    return { content: [{ type: "text", text: summary }] };
  } catch (e) {
    return {
      content: [{ type: "text", text: `Search failed: ${(e as Error).message}` }],
      isError: true,
    };
  }
}

// 百科搜索工具调用(wiki_search / wikisource_search)
async function callWiki(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<McpCallResult> {
  const query = args?.query;
  if (typeof query !== "string" || !query.trim()) {
    return {
      content: [
        {
          type: "text",
          text: "Missing or invalid 'query' (non-empty string required)",
        },
      ],
      isError: true,
    };
  }

  const source = name === "wikisource_search" ? "wikisource" : "wikipedia";
  const limit =
    typeof args?.limit === "number" && args.limit > 0 ? args.limit : 20;
  const search_type = args?.search_type === "title" ? "title" : "text";
  const language = typeof args?.language === "string" ? args.language : "zh";

  try {
    const result = await searchWiki({
      query,
      source,
      language,
      limit,
      search_type,
    });

    const formatted = result.results
      .map(
        (item, i) =>
          `${i + 1}. ${item.title}\n` +
          `   ${item.snippet}\n` +
          `   ${item.url}`
      )
      .join("\n\n");

    const summary = [
      `Wiki Query: "${result.query}"`,
      `Source: ${result.source} (${result.language})`,
      `Total Hits: ${result.total_hits}`,
      `Results: ${result.number_of_results}`,
      "",
      "Results:",
      formatted || "(no results)",
    ].join("\n");

    return { content: [{ type: "text", text: summary }] };
  } catch (e) {
    return {
      content: [
        { type: "text", text: `Wiki search failed: ${(e as Error).message}` },
      ],
      isError: true,
    };
  }
}
