import * as esbuild from "esbuild";

// 将 src/index.js 及其依赖(readability/turndown/linkedom/mcp sdk)打包成单文件
// Cloudflare Workers 通过 dist/worker.js 加载(见 wrangler.toml)
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile: "dist/worker.js",
  legalComments: "none",
  // turndown 等库可能引用 Node 内置模块,Workers 不支持,标记为空实现
  external: [],
});

console.log("✓ build complete: dist/worker.js");
