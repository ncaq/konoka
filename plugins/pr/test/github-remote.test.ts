import { Option } from "effect";
import { describe, expect, it } from "vitest";
import {
  findRemotesFor,
  formatHead,
  ownerFromRemoteUrl,
  parseGitHubRemoteUrl,
  parseRemoteList,
} from "../src/github-remote";

describe("parseGitHubRemoteUrl", () => {
  it.each([
    "https://github.com/NixOS/nixpkgs",
    "https://github.com/NixOS/nixpkgs.git",
    "https://github.com/NixOS/nixpkgs/",
    "https://ncaq@github.com/NixOS/nixpkgs.git",
    "http://github.com/NixOS/nixpkgs.git",
    "git@github.com:NixOS/nixpkgs.git",
    "git@github.com:NixOS/nixpkgs",
    "github-work:NixOS/nixpkgs.git",
    "ssh://git@github.com/NixOS/nixpkgs.git",
    "ssh://git@github.com:22/NixOS/nixpkgs.git",
    "git://github.com/NixOS/nixpkgs.git",
    "  https://github.com/NixOS/nixpkgs.git\n",
  ])("%sからowner/repoを取り出す", (url) => {
    expect(parseGitHubRemoteUrl(url)).toEqual(Option.some({ owner: "NixOS", repo: "nixpkgs" }));
  });

  it.each([
    "",
    "/home/ncaq/Desktop/nixpkgs",
    "file:///home/ncaq/Desktop/nixpkgs",
    "https://github.com/NixOS",
    "https://gitlab.com/group/subgroup/repo.git",
  ])("%sは解釈できず`Option.none`になる", (url) => {
    expect(parseGitHubRemoteUrl(url)).toEqual(Option.none());
  });
});

describe("parseRemoteList", () => {
  it("空の出力は空配列になる", () => {
    expect(parseRemoteList("")).toEqual([]);
  });

  it("fetchの行だけを拾い、pushの行と重複させない", () => {
    const out = [
      "origin\tgit@github.com:ncaq/nixpkgs.git (fetch)",
      "origin\t/tmp/bare.git (push)",
      "upstream\thttps://github.com/NixOS/nixpkgs.git (fetch)",
      "upstream\thttps://github.com/NixOS/nixpkgs.git (push)",
    ].join("\n");
    expect(parseRemoteList(out)).toEqual([
      { name: "origin", url: "git@github.com:ncaq/nixpkgs.git" },
      { name: "upstream", url: "https://github.com/NixOS/nixpkgs.git" },
    ]);
  });

  it("空白を含むURLもそのまま取り出す", () => {
    expect(parseRemoteList("local\t/tmp/my repo (fetch)\nlocal\t/tmp/my repo (push)")).toEqual([
      { name: "local", url: "/tmp/my repo" },
    ]);
  });
});

describe("ownerFromRemoteUrl", () => {
  it("URLが取得できなかった場合は`Option.none`を返す", () => {
    expect(ownerFromRemoteUrl(Option.none())).toEqual(Option.none());
  });

  it("URLを解釈できない場合は`Option.none`を返す", () => {
    expect(ownerFromRemoteUrl(Option.some("/home/ncaq/Desktop/nixpkgs"))).toEqual(Option.none());
  });

  it("GitHubのURLからownerを取り出す", () => {
    expect(ownerFromRemoteUrl(Option.some("git@github.com:ncaq/nixpkgs.git"))).toEqual(
      Option.some("ncaq"),
    );
  });
});

describe("findRemotesFor", () => {
  const origin = { name: "origin", url: "git@github.com:ncaq/nixpkgs.git" } as const;
  const upstream = { name: "upstream", url: "https://github.com/NixOS/nixpkgs.git" } as const;
  const local = { name: "local", url: "/home/ncaq/Desktop/nixpkgs" } as const;
  const mirror = { name: "mirror", url: "https://mirror.example.com/NixOS/nixpkgs.git" } as const;

  it("owner/repoが一致するremoteを返す", () => {
    expect(findRemotesFor([origin, upstream], { owner: "NixOS", repo: "nixpkgs" })).toEqual([
      upstream,
    ]);
  });

  it("大文字小文字を区別せずに比較する", () => {
    expect(findRemotesFor([origin, upstream], { owner: "nixos", repo: "NixPkgs" })).toEqual([
      upstream,
    ]);
  });

  it("URLを解釈できないremoteは読み飛ばす", () => {
    expect(findRemotesFor([local, upstream], { owner: "NixOS", repo: "nixpkgs" })).toEqual([
      upstream,
    ]);
  });

  it("hostの違うmirrorも一致するため、複数一致した場合は全て返す", () => {
    expect(
      findRemotesFor([mirror, origin, upstream], { owner: "NixOS", repo: "nixpkgs" }),
    ).toEqual([mirror, upstream]);
  });

  it("一致するremoteが無ければ空配列を返す", () => {
    expect(findRemotesFor([origin, upstream], { owner: "ncaq", repo: "konoka" })).toEqual([]);
  });

  it("remoteが無ければ空配列を返す", () => {
    expect(findRemotesFor([], { owner: "NixOS", repo: "nixpkgs" })).toEqual([]);
  });
});

describe("formatHead", () => {
  it("push先のownerがbaseのownerと異なればowner付きにする", () => {
    expect(formatHead("feat", "NixOS", Option.some("ncaq"))).toBe("ncaq:feat");
  });

  it("push先のownerがbaseのownerと大文字小文字違いならブランチ名だけにする", () => {
    expect(formatHead("feat", "ncaq", Option.some("NCAQ"))).toBe("feat");
  });

  it("push先のownerが不明ならブランチ名だけにする", () => {
    expect(formatHead("feat", "ncaq", Option.none())).toBe("feat");
  });
});
