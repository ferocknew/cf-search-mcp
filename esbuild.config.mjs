import * as esbuild from "esbuild";

// 将 src/index.ts 及其依赖(readability/turndown/linkedom/mcp sdk)打包成单文件
// 产物 dist/worker.js,纳入 git,供手工下载 zip 上传部署(避免 Workers Builds 锁变量 403)
// wrangler.toml main 指向 dist/worker.js,兼容 wrangler deploy 与手工 zip 两种部署模式
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  // neutral 平台需显式 mainFields,否则 turndown / cssom(linkedom 依赖)的 main field 被忽略无法解析
  mainFields: ["module", "main"],
  outfile: "dist/worker.js",
  legalComments: "none",
  // turndown 等库可能引用 Node 内置模块,Workers 不支持,标记为空实现
  external: [],
});

console.log("✓ build complete: dist/worker.js");
