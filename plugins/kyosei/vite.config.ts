import { defineConfig } from "vite";

/**
 * Vite設定。
 * テスト(vitest)とCLIエントリのバンドルの両方をViteで行います。
 * Node.jsターゲットなので`build.ssr`を有効にし、依存はすべて`ssr.noExternal`でバンドルに含めます。
 * `.mustache`テンプレートは`assetsInclude`でアセット扱いにし、`?raw`サフィックス付きインポートで文字列として取り込みます。
 */
export default defineConfig({
  assetsInclude: ["**/*.mustache"],
  build: {
    ssr: true,
    target: "node20.20",
    outDir: "dist/bin",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: {
        "get-review-info": "src/bin/get-review-info.ts",
        "submit-review": "src/bin/submit-review.ts",
      },
      output: {
        format: "esm",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        // ESM出力下でもCJS依存(octokit配下など)が`require`を期待する場合のフォールバック。
        banner: [
          "import { createRequire as ___createRequire } from 'node:module';",
          "const require = ___createRequire(import.meta.url);",
        ].join("\n"),
      },
    },
  },
  ssr: {
    // 全依存をバンドルに含めます(デフォルトは external のため明示)。
    noExternal: true,
  },
});
