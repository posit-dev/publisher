import * as esbuild from "esbuild";

async function buildTests() {
  const ctx = await esbuild.context({
    // index.ts is the Mocha entry point for the Positron-only suite; it is
    // loaded by @posit-dev/positron-test-electron (see
    // scripts/run-positron-tests.mjs).
    entryPoints: ["src/test/**/*.test.ts", "src/test/positron/index.ts"],
    bundle: true,
    format: "cjs",
    minify: false,
    sourcemap: true,
    platform: "node",
    outdir: "out/test",
    // Pin the output layout so out/test mirrors src/test (suite/, positron/)
    // regardless of which entry points exist.
    outbase: "src/test",
    // mocha is resolved from node_modules at runtime by the Positron suite's
    // entry point; bundling it breaks its dynamic requires.
    external: ["vscode", "mocha"],
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
