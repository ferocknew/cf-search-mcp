# cf-search-mcp 项目指南

## session 概要(2026-07-29 更新)

### 项目概述
- 部署到 Cloudflare Workers 的多引擎搜索 MCP 服务,已用 TypeScript 重写
- 仓库:git@github.com:ferocknew/cf-search-mcp.git
- 参考:Yrobot/cloudflare-search
- 生产地址:https://cf-search-mcp.ferock.workers.dev/

### 架构决策
- Worker 直接提供 MCP HTTP 端点(Streamable HTTP),非独立 npm 包
- 多引擎按权重顺序降级搜索(非并行,省请求次数),首个有结果即返回
- 自集成 @mozilla/readability + turndown(网页抓取阅读模式)
- 百科搜索(wikipedia/wikisource/教育百科)为独立工具,不参与主降级链
- TOKEN 鉴权(可选);SEARCH_CONFIG 配引擎开关与优先级
- TypeScript(strict + workers-types + esbuild 打包)

### 构建与部署
- 构建:npm run build(先 tsc --noEmit 类型检查,再 esbuild 打包)
- 产物:dist/worker.js;入口:src/index.ts
- 部署:npm run deploy;推荐 CF Workers Builds Git 自动部署(push 触发)

### 环境变量(CF 后台 Variables and Secrets)
- SEARCH_CONFIG:Text 或 JSON,引擎优先级,如 {"baidu":2};兼容 string|object
- TOKEN:可选,鉴权令牌;DEFAULT_TIMEOUT:单引擎超时,默认 8000
- 各引擎 key(TAVILY/SERPAPI/SERPER/SEARCH1API/JINA/BAIDU_API_KEY):Secret
- wrangler.toml 必须设 keep_vars=true,否则 deploy 清后台文本变量

### 当前状态
- ✅ M0 骨架、M1 主搜索降级链(/search 已上线)
- ✅ M4 Web 界面(/ 已上线,Tailwind CDN+降级顺序展示+Token 弹框)
- ✅ M5 MCP 端点(/mcp 已上线,无状态 Streamable HTTP,工具 search)
- ✅ JS→TS 迁移;线上 baidu 实测通过,TOKEN 鉴权正常
- ⏳ M2 百科搜索、M3 网页抓取待实现

### 教训与注意事项
- wrangler deploy 会清后台非加密文本变量(TOKEN/SEARCH_CONFIG),keep_vars=true 解决
- CF JSON 类型变量运行时注入为对象,代码需兼容 string|object(否则 .trim 报错 500)
- workers-types@4 的 Response.json() 返回 unknown(非 any),需 as 断言
- 不在本机测试付费 API,先 CF 部署配 key 验证
- baidu 是百度千帆 AI 搜索(非 HTML 解析),已实测通过;search1api/jina 待实测
- 模板字符串里嵌客户端 JS,字符串一律用单引号拼接(`\"` 会被模板层吃成裸 `"`,tsc 查不出)
- @modelcontextprotocol/sdk server transport 绑定 Node 框架(express/hono),Workers 不适用;无状态 MCP 手写更稳
- /mcp 必须绕开通用 parseParams+params.token 鉴权(JSON-RPC body 不能当表单解析),用 Bearer header
