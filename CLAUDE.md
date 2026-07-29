# cf-search-mcp 项目指南

## session 概要(2026-07-29 更新)

### 项目概述
- 部署到 Cloudflare Workers 的多引擎搜索 MCP 服务,TypeScript 重写
- 仓库:git@github.com:ferocknew/cf-search-mcp.git
- 参考:Yrobot/cloudflare-search;mcp_searxng_python(Python 版,百科/抓取参考)

### 架构决策
- Worker 直接提供 MCP HTTP 端点(Streamable HTTP),非独立 npm 包
- 多引擎按权重顺序降级搜索(非并行,省请求次数),首个有结果即返回
- 自集成 @mozilla/readability + linkedom + turndown(网页抓取阅读模式)
- 百科搜索(wikipedia/wikisource/教育百科)为独立工具,不参与主降级链
- TOKEN 鉴权(可选);SEARCH_CONFIG 配引擎开关与优先级
- TypeScript(strict + workers-types + esbuild 打包)

### 构建与部署
- 构建:npm run build(先 tsc --noEmit,再 esbuild 打包到 dist/worker.js)
- 入口:src/index.ts;产物 dist/worker.js 纳入 git(供手工 zip 部署)
- 部署:npm run deploy;或 CF Workers Builds Git 自动部署(push 触发)

### 环境变量(CF 后台 Variables and Secrets)
- SEARCH_CONFIG:Text/JSON,引擎优先级,如 {"baidu":2};兼容 string|object
- TOKEN:可选鉴权;DEFAULT_TIMEOUT:单引擎超时,默认 8000
- 各引擎 key(TAVILY/SERPAPI/SERPER/SEARCH1API/JINA/BAIDU):Secret
- wrangler.toml 需 keep_vars=true,否则 deploy 清后台文本变量

### 当前状态(均线上验证通过)
- ✅ M1 主搜索降级链 /search(tavily/serpapi/serper/search1api/jina/baidu)
- ✅ M2 百科搜索:wiki_search(wikipedia 多语言)+ wikisource_search(中文文库),MediaWiki API
- ✅ M3 网页抓取:web_fetch(txt/markdown/html_body/html_raw),readability+linkedom+turndown
- ✅ M4 Web 界面 /、M5 MCP 端点 /mcp(无状态 Streamable HTTP,共 4 工具)
- ⏳ 教育百科 pedia_search 暂缓(接口待调研;web_fetch 已能抓其 Detail 页)

### 教训与注意事项
- Wikimedia API 必须浏览器级 UA+Referer,否则反滥用系统 403(Workers 默认 UA 被拦)
- 无 DOM lib(仅 ES2022+workers-types):Readability 用构造签名断言绕过 Document 类型
- esbuild platform neutral 需 mainFields:['module','main'],否则 turndown/cssom 打包失败
- wrangler deploy 清后台非加密文本变量(TOKEN/SEARCH_CONFIG),keep_vars=true 解决
- CF JSON 类型变量运行时注入为对象,代码需兼容 string|object(否则 .trim 报 500)
- workers-types@4 的 Response.json() 返回 unknown,需 as 断言
- 不在本机测付费 API,先 CF 部署配 key 验证;baidu 是千帆 AI 搜索(非 HTML 解析)
- web 模板字符串嵌客户端 JS 时,字符串一律单引号拼接(反斜杠转义会被模板层吃掉)
- @modelcontextprotocol/sdk transport 绑 Node 框架,Workers 不适用;无状态 MCP 手写更稳
- /mcp 绕开通用 parseParams 鉴权(JSON-RPC body 不能当表单解析),用 Bearer header
- 部署后改后台变量会 403,须删 Worker 重建:先配变量再链 GitHub 部署
