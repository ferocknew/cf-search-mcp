import type { Env } from "./types";

// 环境变量集中管理
// Workers 每次请求会把 env 对象传入 fetch handler,这里通过 setEnv 暂存到模块作用域
// 各引擎/路由通过 getEnv() 读取当前请求的环境变量

const DEFAULTS: Partial<Env> = {
  // 单引擎超时(毫秒),付费 API 比免费 HTML 解析慢,默认给宽裕些
  DEFAULT_TIMEOUT: "8000",
};

let _env: Env = { ...DEFAULTS };

// 由 Worker 入口调用,写入当前请求的 env
export function setEnv(envObj: Partial<Env> = {}): void {
  _env = { ...DEFAULTS, ...envObj };
}

// 读取当前请求的 env(含默认值)
export function getEnv(): Env {
  return _env;
}

// 引擎名 -> 所需 API key 环境变量名
const ENGINE_KEY_MAP: Record<string, string> = {
  tavily: "TAVILY_API_KEY",
  serpapi: "SERPAPI_API_KEY",
  serper: "SERPER_API_KEY",
  search1api: "SEARCH1API_KEY",
  jina: "JINA_API_KEY",
  baidu: "BAIDU_API_KEY",
};

// 解析主搜索配置(SEARCH_CONFIG 环境变量)
// 简洁式格式:{ "tavily": 1, "serper": 3, ... }
//   - 列出的引擎 = 启用,值为优先级(数字小的先尝试)
//   - 未列出 = 禁用
//   - 启用且配置了对应 API key 的引擎才真正生效
// 返回按优先级升序排列的引擎名数组
// CF Text 变量传入为字符串;JSON 类型变量会被 Workers 运行时注入为已解析对象,两种都支持
export function getEnabledEngines(): string[] {
  const env = getEnv();
  const raw: unknown = env.SEARCH_CONFIG;
  if (raw == null) return [];

  // CF Text 变量传入为字符串;JSON 类型变量会被 Workers 运行时注入为已解析对象
  let config: Record<string, number>;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      config = JSON.parse(trimmed) as Record<string, number>;
    } catch (e) {
      console.error(
        "[env] SEARCH_CONFIG JSON parse error:",
        (e as Error).message
      );
      return [];
    }
  } else if (typeof raw === "object") {
    config = raw as Record<string, number>;
  } else {
    return [];
  }

  const entries = Object.entries(config)
    .map(([name, priority]) => ({
      name: String(name).toLowerCase(),
      priority: Number(priority),
    }))
    .filter((e) => {
      const keyName = ENGINE_KEY_MAP[e.name];
      return (
        !!keyName &&
        !!((env as Record<string, unknown>)[keyName]) && // 已配置 key
        !Number.isNaN(e.priority)
      );
    });
  entries.sort((a, b) => a.priority - b.priority);
  return entries.map((e) => e.name);
}
