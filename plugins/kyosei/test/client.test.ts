import process from "node:process";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createOctokitClient, tokenEnvironmentVariableNameList } from "../src/client.js";

/**
 * テスト中に環境変数を差し替えるヘルパー。
 * 元の値を保存して、afterEachで復元します。
 */
function withEnv(overrides: Record<string, string | undefined>): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    const value = overrides[key];
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

describe("createOctokitClient", () => {
  // GitHub ActionsのCI環境で設定される典型的な環境変数をテスト前にクリアして、
  // テスト後に復元します。
  const envKeysToClean = [...tokenEnvironmentVariableNameList, "GH_HOST", "GITHUB_API_URL", "GITHUB_SERVER_URL"];

  beforeEach(() => {
    const overrides: Record<string, undefined> = {};
    for (const key of envKeysToClean) {
      overrides[key] = undefined;
    }
    const restoreEnv = withEnv(overrides);
    return () => {
      restoreEnv();
      vi.restoreAllMocks();
    };
  });

  // URL.toString()は末尾スラッシュを付けるため、
  // そのままOctokitに渡すとダブルスラッシュのURLが生成されて404になる。
  describe("baseUrlの末尾スラッシュによるダブルスラッシュの防止", () => {
    test.each([
      { label: "GITHUB_API_URL", env: { GITHUB_API_URL: "https://api.github.com" } },
      { label: "GITHUB_SERVER_URL", env: { GITHUB_SERVER_URL: "https://github.com" } },
      { label: "GitHub Enterprise", env: { GITHUB_API_URL: "https://ghe.example.com/api/v3" } },
    ])("$labelが設定されている場合、APIリクエストのURLにダブルスラッシュが含まれない", async ({ env }) => {
      const restore = withEnv({ GITHUB_TOKEN: "ghp_test_token", ...env });
      try {
        const requestedUrls: string[] = [];
        const mockFetch = vi.fn().mockImplementation((url: string | URL) => {
          requestedUrls.push(url.toString());
          return Promise.resolve(
            new Response(JSON.stringify({ default_branch: "main" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          );
        });
        vi.stubGlobal("fetch", mockFetch);

        const octokit = await createOctokitClient();
        await octokit.rest.repos.get({ owner: "test-owner", repo: "test-repo" });

        expect(requestedUrls.length).toBeGreaterThan(0);
        for (const url of requestedUrls) {
          // プロトコル部分(https://)の後にダブルスラッシュがないことを確認します。
          const afterProtocol = url.replace(/^https?:\/\//, "");
          expect(afterProtocol).not.toContain("//");
        }
      } finally {
        restore();
      }
    });
  });
});
