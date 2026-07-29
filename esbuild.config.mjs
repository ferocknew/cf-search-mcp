import * as esbuild from "esbuild";

// 将 src/index.ts 及其依赖(readability/turndown/linkedom/mcp sdk)打包成单文件 _worker.js
// Cloudflare Workers 通过 _worker.js 加载(见 wrangler.toml main)
// 产物在项目根目录并纳入 git,供手工下载 zip 上传部署(避免 Workers Builds 锁变量 403)
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile: "_worker.js",
  legalComments: "none",
  // turndown 等库可能引用 Node 内置模块,Workers 不支持,标记为空实现
  external: [],
});

console.log("✓ build complete: _worker.js");
