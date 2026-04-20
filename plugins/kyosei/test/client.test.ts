import process from "node:process";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createOctokitClient, tokenEnvironmentVariableNameList } from "../src/client.js";

/**
 * テスト中に環境変数を差し替えるヘルパー。
 * 元の値を保存し、返却されたクリーンアップ関数を呼ぶことで復元します。
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

  /**
   * fetchをモックして、リクエストされたURLを記録するヘルパー。
   * 返されたURL配列を検証に使います。
   */
  function mockFetchAndCaptureUrls(): string[] {
    const requestedUrls: string[] = [];
    const mockFetch = vi.fn().mockImplementation((url: string | URL) => {
      requestedUrls.push(url.toString());
      return Promise.resolve(
        new Response(JSON.stringify({ default_branch: "master" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", mockFetch);
    return requestedUrls;
  }

  // getGitHubBaseUrlはexportされていないため、
  // createOctokitClient経由でfetchのリクエスト先URLを検証することで間接的にテストしています。
  describe("getGitHubBaseUrlの解決", () => {
    test.each([
      {
        label: "GITHUB_API_URLが直接指定",
        env: { GITHUB_API_URL: "https://api.github.com" },
        expectedOrigin: "https://api.github.com",
      },
      {
        label: "GITHUB_SERVER_URLがgithub.com",
        env: { GITHUB_SERVER_URL: "https://github.com" },
        expectedOrigin: "https://api.github.com",
      },
      {
        label: "GITHUB_SERVER_URLがGHE",
        env: { GITHUB_SERVER_URL: "https://ghe.example.com" },
        expectedOrigin: "https://ghe.example.com",
        expectedPathPrefix: "/api/v3",
      },
      {
        label: "GH_HOSTがgithub.com",
        env: { GH_HOST: "github.com" },
        expectedOrigin: "https://api.github.com",
      },
      {
        label: "GH_HOSTがGHE",
        env: { GH_HOST: "ghe.example.com" },
        expectedOrigin: "https://ghe.example.com",
        expectedPathPrefix: "/api/v3",
      },
      {
        label: "何も設定なし(デフォルト)",
        env: {},
        expectedOrigin: "https://api.github.com",
      },
    ])("$labelの場合、$expectedOriginにリクエストが送られる", async ({ env, expectedOrigin, expectedPathPrefix }) => {
      const restore = withEnv({ GITHUB_TOKEN: "ghp_test_token", ...env });
      try {
        const requestedUrls = mockFetchAndCaptureUrls();

        const octokit = await createOctokitClient();
        await octokit.rest.repos.get({ owner: "test-owner", repo: "test-repo" });

        expect(requestedUrls.length).toBeGreaterThan(0);
        for (const urlString of requestedUrls) {
          const url = new URL(urlString);
          expect(url.origin).toBe(expectedOrigin);
          if (expectedPathPrefix != null) {
            expect(url.pathname).toSatisfy((p: string) => p.startsWith(expectedPathPrefix));
          }
        }
      } finally {
        restore();
      }
    });
  });

  // URL.toString()は末尾スラッシュを付けるため、
  // そのままOctokitに渡すとダブルスラッシュのURLが生成されて404になる。
  describe("baseUrlの末尾スラッシュによるダブルスラッシュの防止", () => {
    test.each([
      { label: "GITHUB_API_URL", env: { GITHUB_API_URL: "https://api.github.com" } },
      { label: "GITHUB_SERVER_URL(github.com)", env: { GITHUB_SERVER_URL: "https://github.com" } },
      { label: "GITHUB_SERVER_URL(GHE)", env: { GITHUB_SERVER_URL: "https://ghe.example.com" } },
      { label: "GH_HOST(github.com)", env: { GH_HOST: "github.com" } },
      { label: "GH_HOST(GHE)", env: { GH_HOST: "ghe.example.com" } },
      { label: "デフォルト", env: {} },
    ])("$labelの場合、APIリクエストのURLにダブルスラッシュが含まれない", async ({ env }) => {
      const restore = withEnv({ GITHUB_TOKEN: "ghp_test_token", ...env });
      try {
        const requestedUrls = mockFetchAndCaptureUrls();

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
