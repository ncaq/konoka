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
        "commit-prepare": "src/bin/commit-prepare.ts",
        "konoka-editor": "src/bin/konoka-editor.ts",
        "read-commit-instructions": "src/bin/read-commit-instructions.ts",
        "run-commit-msg-hook": "src/bin/run-commit-msg-hook.ts",
        "show-staged-patch": "src/bin/show-staged-patch.ts",
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
