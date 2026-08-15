import { defineConfig } from "vite";

/**
 * Vite設定。
 * テスト(vitest)とCLIエントリのバンドルの両方をViteで行います。
 * Node.jsターゲットなので`build.ssr`を有効にし、
 * 依存はすべて`ssr.noExternal`でバンドルに含めます。
 */
export default defineConfig({
  build: {
    ssr: true,
    target: "node20.20",
    outDir: "dist/bin",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: {
        "get-respond-info": "src/bin/get-respond-info.ts",
        "reply-and-resolve": "src/bin/reply-and-resolve.ts",
      },
      output: {
        format: "esm",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
      },
    },
  },
  ssr: {
    // 全依存をバンドルに含めます(デフォルトは external のため明示)。
    // 外部化したままだとCJSパッケージのディレクトリインポートを
    // Node.jsのESM resolverが解決できず`ERR_UNSUPPORTED_DIR_IMPORT`になることがあります。
    noExternal: true,
  },
});
