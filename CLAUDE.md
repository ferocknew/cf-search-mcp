# cf-search-mcp 项目指南

## session 概要(2026-07-29)

### 项目概述
- 部署到 Cloudflare Workers 的多引擎搜索 MCP 服务
- 仓库:git@github.com:ferocknew/cf-search-mcp.git
- 参考项目:Yrobot/cloudflare-search

### 架构决策
1. Worker 直接提供 MCP HTTP 端点(Streamable HTTP transport),非独立 npm 包
2. 多引擎按权重顺序降级搜索(非并行,省请求次数),首个有结果即返回
3. 自集成 @mozilla/readability + turndown(网页抓取阅读模式)
4. 百科搜索(wikipedia/wikisource/教育百科)为独立工具,不参与主降级链
5. TOKEN 鉴权(可选),JSON 配置搜索引擎开关与优先级

### 构建与部署
- 构建:esbuild 打包到 dist/worker.js
- 部署:npm run deploy(wrangler deploy)
- 推荐:CF Workers Builds Git 自动部署(连接 GitHub 仓库,不需 wrangler login)
- 构建命令:npm run build;部署命令:npm run deploy

### 搜索引擎配置
- 环境变量 SEARCH_CONFIG(JSON 简洁式),如:{"tavily":1,"serper":3,"jina":4}
- 列出=启用,值为优先级(小=先尝试),未列=禁用
- 各引擎需配置对应 API key(Secret)才生效
- 引擎 API 格式详见 docs/search_readme.md

### 当前状态
- ✅ M0 项目骨架(esbuild+wrangler 验证通过)
- ✅ M1 主搜索降级链(6 引擎+降级调度+/search 路由)
- ⏳ M2 百科搜索(进行中)
- ⏳ M3 网页抓取
- ⏳ M4 Web 界面
- ⏳ M5 MCP 端点
- ⏳ M6 构建部署

### 教训与注意事项
- 不要在本机测试付费 LLM API(避免触发监管),先 CF 部署配 key 验证
- search1api 和 jina 的响应字段是按文档推断的,需真 key 确认
- baidu 是百度千帆 AI 搜索 API(非 HTML 解析)
