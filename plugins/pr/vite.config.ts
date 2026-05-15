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
    target: "node22",
    outDir: "dist/bin",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: {
        "konoka-editor": "src/bin/konoka-editor.ts",
        "prepare-editmsg": "src/bin/prepare-editmsg.ts",
        "read-contributing": "src/bin/read-contributing.ts",
        "read-pull-request-template": "src/bin/read-pull-request-template.ts",
        "sync-and-push": "src/bin/sync-and-push.ts",
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
    noExternal: true,
  },
});
