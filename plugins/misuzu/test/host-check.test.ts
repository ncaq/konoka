import { Effect } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ReviewContext } from "../src/context-type";
import { verifyContextHost } from "../src/host-check";

function githubContext(host: string): ReviewContext {
  return {
    output: "github",
    host,
    pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
  };
}

const localContext: ReviewContext = { output: "local", baseBranch: "master" };

const baseUrlEnvironmentVariableNameList = [
  "GITHUB_API_URL",
  "GITHUB_SERVER_URL",
  "GH_HOST",
] as const;

function stubBaseUrlEnvironment(values: Partial<Record<string, string>>): void {
  for (const name of baseUrlEnvironmentVariableNameList) {
    const value = values[name];
    if (value == null) {
      vi.stubEnv(name, undefined);
    } else {
      vi.stubEnv(name, value);
    }
  }
}

describe("verifyContextHost", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("環境変数未設定でgithub.comのURLなら成功する", () => {
    stubBaseUrlEnvironment({});
    expect(() => Effect.runSync(verifyContextHost(githubContext("github.com")))).not.toThrow();
  });

  test("環境変数未設定でGHEのURLならHostMismatchで失敗する", () => {
    stubBaseUrlEnvironment({});
    const error = Effect.runSync(
      verifyContextHost(githubContext("ghe.example.com")).pipe(Effect.flip),
    );
    expect(error).toMatchObject({
      _tag: "HostMismatch",
      contextHost: "ghe.example.com",
      clientHost: "github.com",
    });
  });

  test("GITHUB_SERVER_URLがGHEを指す場合はGHEのURLが成功する", () => {
    stubBaseUrlEnvironment({ GITHUB_SERVER_URL: "https://ghe.example.com" });
    expect(() => Effect.runSync(verifyContextHost(githubContext("ghe.example.com")))).not.toThrow();
  });

  test("GITHUB_SERVER_URLがGHEを指す場合はgithub.comのURLが失敗する", () => {
    stubBaseUrlEnvironment({ GITHUB_SERVER_URL: "https://ghe.example.com" });
    const error = Effect.runSync(verifyContextHost(githubContext("github.com")).pipe(Effect.flip));
    expect(error).toMatchObject({ _tag: "HostMismatch", clientHost: "ghe.example.com" });
  });

  test("GITHUB_API_URLがapi.github.comの場合はgithub.comのURLが成功する", () => {
    stubBaseUrlEnvironment({ GITHUB_API_URL: "https://api.github.com" });
    expect(() => Effect.runSync(verifyContextHost(githubContext("github.com")))).not.toThrow();
  });

  test("hostを持たないローカルコンテキストでは何も検証しない", () => {
    stubBaseUrlEnvironment({ GITHUB_SERVER_URL: "https://ghe.example.com" });
    expect(() => Effect.runSync(verifyContextHost(localContext))).not.toThrow();
  });
});
