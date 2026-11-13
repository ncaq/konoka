import { chdir, cwd, env } from "node:process";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Effect, FileSystem, Path, type Scope } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/process";
import { afterEach, beforeEach, describe, expect } from "vitest";
import { type CommandFailedError, runStdout } from "../src/run";
import {
  fetchBase,
  isAncestor,
  rebaseOntoBaseIfNeeded,
  resolveBaseRemote,
  validateBaseBranch,
} from "../src/sync-base";

type GitEffect<A> = Effect.Effect<
  A,
  CommandFailedError | PlatformError,
  ChildProcessSpawner.ChildProcessSpawner
>;

/** カレントディレクトリでgitを実行します。 */
function git(...args: readonly string[]): GitEffect<string> {
  return runStdout("git", args);
}

/** 空のコミットを作ります。 */
function commit(message: string): GitEffect<string> {
  return git("commit", "--quiet", "--allow-empty", "-m", message);
}

/**
 * 上流役のbareリポジトリと、
 * そこへpushするためのseedリポジトリと、
 * 作業用のcloneを作ります。
 * cloneのremote`origin`は上流役のbareリポジトリをローカルパスで指します。
 * 作業ブランチ`feat`をcheckoutしたcloneにcwdを移します。
 */
const setupClone = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  const upstream = path.join(root, "upstream.git");
  const seed = path.join(root, "seed");
  const clone = path.join(root, "clone");
  yield* git("init", "--quiet", "--bare", "--initial-branch=master", upstream);
  yield* git("init", "--quiet", "--initial-branch=master", seed);
  chdir(seed);
  yield* commit("initial");
  yield* git("remote", "add", "origin", upstream);
  yield* git("push", "--quiet", "origin", "master");
  yield* git("clone", "--quiet", upstream, clone);
  chdir(clone);
  yield* git("switch", "--quiet", "-c", "feat");
  yield* commit("feat");
  return { seed, clone };
});

/** seedリポジトリでmasterを1コミット進めて上流へpushし、cloneへ戻ります。 */
function advanceUpstream(seed: string, clone: string): GitEffect<void> {
  return Effect.gen(function* () {
    chdir(seed);
    yield* commit("advance");
    yield* git("push", "--quiet", "origin", "master");
    chdir(clone);
  });
}

describe("syncBaseのgit操作", () => {
  const originalCwd = cwd();
  const originalEnv = { ...env };

  beforeEach(() => {
    // 利用者のgit設定(コミット署名など)に左右されないように、
    // グローバル設定とシステム設定を読まずにコミットできる環境にします。
    Object.assign(env, {
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "konoka",
      GIT_AUTHOR_EMAIL: "konoka@example.com",
      GIT_COMMITTER_NAME: "konoka",
      GIT_COMMITTER_EMAIL: "konoka@example.com",
    });
  });

  afterEach(() => {
    // テストごとにcwdと環境変数を戻します。
    chdir(originalCwd);
    for (const key of Object.keys(env)) {
      if (!(key in originalEnv)) {
        Reflect.deleteProperty(env, key);
      }
    }
    Object.assign(env, originalEnv);
  });

  describe("validateBaseBranch", () => {
    it.effect("ブランチ名として正しければ成功する", () =>
      validateBaseBranch("release-26.05").pipe(Effect.provide(NodeServices.layer)),
    );

    it.effect.each(["@{-1}", "a..b", "a b", "a~1"])(
      "%sは`InvalidBaseBranchError`で失敗する",
      (baseBranch) =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(validateBaseBranch(baseBranch));
          expect(error._tag).toBe("InvalidBaseBranchError");
        }).pipe(Effect.provide(NodeServices.layer)),
    );
  });

  describe("resolveBaseRemote", () => {
    /** GitHubのURLのremoteを登録しただけのリポジトリにcwdを移します。通信はしません。 */
    function setupRemotes(
      remotes: readonly (readonly [string, string])[],
    ): Effect.Effect<
      void,
      CommandFailedError | PlatformError,
      ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Scope.Scope
    > {
      return Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* fs.makeTempDirectoryScoped();
        yield* git("init", "--quiet", repo);
        chdir(repo);
        for (const [name, url] of remotes) {
          yield* git("remote", "add", name, url);
        }
      });
    }

    it.effect("一致するremoteが1つならその名前を返す", () =>
      Effect.gen(function* () {
        yield* setupRemotes([
          ["origin", "git@github.com:ncaq/nixpkgs.git"],
          ["upstream", "https://github.com/NixOS/nixpkgs.git"],
        ]);
        expect(yield* resolveBaseRemote("NixOS", "nixpkgs")).toBe("upstream");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );

    it.effect("一致するremoteが無ければ`BaseRemoteNotFoundError`で失敗する", () =>
      Effect.gen(function* () {
        yield* setupRemotes([["origin", "git@github.com:ncaq/nixpkgs.git"]]);
        const error = yield* Effect.flip(resolveBaseRemote("NixOS", "nixpkgs"));
        expect(error._tag).toBe("BaseRemoteNotFoundError");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );

    it.effect("一致するremoteが複数あれば`AmbiguousBaseRemoteError`で失敗する", () =>
      Effect.gen(function* () {
        yield* setupRemotes([
          ["mirror", "https://mirror.example.com/NixOS/nixpkgs.git"],
          ["upstream", "https://github.com/NixOS/nixpkgs.git"],
        ]);
        const error = yield* Effect.flip(resolveBaseRemote("NixOS", "nixpkgs"));
        expect(error._tag).toBe("AmbiguousBaseRemoteError");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );
  });

  describe("fetchBaseとrebaseOntoBaseIfNeeded", () => {
    it.effect("ローカルにbaseブランチが無くてもremote追跡ブランチへfetchする", () =>
      Effect.gen(function* () {
        yield* setupClone;
        const baseRef = yield* fetchBase("origin", "master");
        expect(baseRef).toBe("refs/remotes/origin/master");
        expect(yield* git("rev-parse", "--verify", "--quiet", baseRef)).not.toBe("");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );

    it.effect("存在しないbaseブランチのfetchは失敗する", () =>
      Effect.gen(function* () {
        yield* setupClone;
        const error = yield* Effect.flip(fetchBase("origin", "nope"));
        expect(error._tag).toBe("CommandFailedError");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );

    it.effect("baseが進んでいなければrebaseしない", () =>
      Effect.gen(function* () {
        yield* setupClone;
        const head = yield* git("rev-parse", "HEAD");
        const baseRef = yield* fetchBase("origin", "master");
        expect(yield* rebaseOntoBaseIfNeeded(baseRef, "master", "feat")).toBe(false);
        expect(yield* git("rev-parse", "HEAD")).toBe(head);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );

    it.effect("baseが進んでいればbaseの上にrebaseする", () =>
      Effect.gen(function* () {
        const { seed, clone } = yield* setupClone;
        yield* advanceUpstream(seed, clone);
        const baseRef = yield* fetchBase("origin", "master");
        expect(yield* isAncestor(baseRef)).toBe(false);
        expect(yield* rebaseOntoBaseIfNeeded(baseRef, "master", "feat")).toBe(true);
        expect(yield* isAncestor(baseRef)).toBe(true);
        expect(yield* git("rev-list", "--count", `${baseRef}..HEAD`)).toBe("1");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );
  });
});
