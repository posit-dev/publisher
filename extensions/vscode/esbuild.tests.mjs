import * as esbuild from "esbuild";

async function buildTests() {
  const ctx = await esbuild.context({
    entryPoints: ["src/test/**/*.test.ts"],
    bundle: true,
    format: "cjs",
    minify: false,
    sourcemap: true,
    platform: "node",
    outdir: "out/test",
    external: ["vscode"],
    tsconfig: "tsconfig.test.json",
  });

  await ctx.rebuild();
  await ctx.dispose();
}

try {
  await Promise.allSettled([buildTests()]);
} catch (e) {
  console.error(e);
  process.exit(1);
}
