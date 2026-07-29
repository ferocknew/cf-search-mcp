import { searchWithFallback } from "../search";
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

const WEB_SEARCH_DESCRIPTION =
  "Search the web for current information across multiple engines " +
  "(tavily / serpapi / serper / search1api / jina / baidu, fallback by configured priority). " +
  "Returns results with title, description, url and the source engine that produced them. " +
  "Use this when you need real-time information beyond your training data.";

// 工具列表:仅 web_search(功能唯一,避免重复暴露)
export const MCP_TOOLS: McpTool[] = [
  {
    name: "web_search",
    description: WEB_SEARCH_DESCRIPTION,
    inputSchema: searchInputSchema(),
  },
];

// 执行工具调用:校验参数 → 调降级搜索 → 格式化为 text(参考 Yrobot/cloudflare-search 的 mcp/cf-search-mcp.js)
export async function callTool(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<McpCallResult> {
  if (name !== "web_search") {
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
