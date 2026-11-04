import { describe, expect, test } from "vitest";
import { wrapBareUrls } from "../src/markdown-autolink";

describe("wrapBareUrls", () => {
  test("URLの直後に日本語が続いても、URLの範囲だけを囲む", () => {
    expect(
      wrapBareUrls(
        "リリースノート(https://github.com/AngleSharp/AngleSharp/releases/tag/v1.9.1)の変更点は次の4つです。",
      ),
    ).toBe(
      "リリースノート(<https://github.com/AngleSharp/AngleSharp/releases/tag/v1.9.1>)の変更点は次の4つです。",
    );
  });

  test("日本語が直接続く場合も非ASCII文字の手前で打ち切る", () => {
    expect(wrapBareUrls("see https://example.com/x。次")).toBe("see <https://example.com/x>。次");
    expect(wrapBareUrls("see https://example.com/xです")).toBe("see <https://example.com/x>です");
  });

  test("空白で区切られたURLも囲む", () => {
    expect(wrapBareUrls("see https://example.com/x ok")).toBe("see <https://example.com/x> ok");
    expect(wrapBareUrls("https://example.com/x")).toBe("<https://example.com/x>");
  });

  test("httpスキームと大文字のスキームも対象にする", () => {
    expect(wrapBareUrls("http://example.com/x と HTTPS://example.com/y")).toBe(
      "<http://example.com/x> と <HTTPS://example.com/y>",
    );
  });

  test("GFMが除外する末尾の記号は囲みの外に出す", () => {
    expect(wrapBareUrls("https://example.com/a_b_ と https://example.com/a. と")).toBe(
      "<https://example.com/a_b>_ と <https://example.com/a>. と",
    );
    expect(wrapBareUrls('"https://example.com/x" と https://example.com/y?!')).toBe(
      '"<https://example.com/x>" と <https://example.com/y>?!',
    );
  });

  test("閉じ括弧は開き括弧より多い分だけ外に出す", () => {
    expect(wrapBareUrls("(https://example.com/x) と https://example.com/(a)) と")).toBe(
      "(<https://example.com/x>) と <https://example.com/(a)>) と",
    );
    expect(wrapBareUrls("https://en.wikipedia.org/wiki/Foo_(bar) です")).toBe(
      "<https://en.wikipedia.org/wiki/Foo_(bar)> です",
    );
  });

  test("末尾のセミコロンは文字実体参照ならその全体を、そうでなければセミコロンだけを外に出す", () => {
    expect(wrapBareUrls("https://example.com/x&amp; と https://example.com/y; と")).toBe(
      "<https://example.com/x>&amp; と <https://example.com/y>; と",
    );
  });

  test("連続する末尾記号は繰り返し外に出す", () => {
    expect(wrapBareUrls("**https://example.com/x**と")).toBe("**<https://example.com/x>**と");
  });

  test("ASCII英字の直後に続くスキームはGitHubと同じく自動リンクにならないので触らない", () => {
    expect(wrapBareUrls("foohttps://example.com/x と")).toBe("foohttps://example.com/x と");
  });

  test("非ASCII文字や数字や記号の直後のURLは囲む", () => {
    expect(wrapBareUrls("ノートhttps://example.com/x と 1https://example.com/y と")).toBe(
      "ノート<https://example.com/x> と 1<https://example.com/y> と",
    );
  });

  test("スキームだけでホストが無いものは触らない", () => {
    expect(wrapBareUrls("https:// と https://. と")).toBe("https:// と https://. と");
  });

  test("既に<URL>で囲まれているものは二重に囲まない", () => {
    expect(wrapBareUrls("see <https://example.com/x>の後")).toBe("see <https://example.com/x>の後");
  });

  test("インラインリンクのテキストとリンク先は触らない", () => {
    expect(wrapBareUrls("[https://example.com/x](https://example.com/x)の後")).toBe(
      "[https://example.com/x](https://example.com/x)の後",
    );
    expect(wrapBareUrls("![alt](https://example.com/a.png) と https://example.com/b")).toBe(
      "![alt](https://example.com/a.png) と <https://example.com/b>",
    );
  });

  test("リンクではない角括弧の後ろのURLは囲む", () => {
    expect(wrapBareUrls("> [!NOTE]\n> see https://example.com/x)の後 [x](y)")).toBe(
      "> [!NOTE]\n> see <https://example.com/x>)の後 [x](y)",
    );
  });

  test("比較演算子の<と>の間にあるURLは囲む", () => {
    expect(wrapBareUrls("a < b なので https://example.com/x)の、c > d")).toBe(
      "a < b なので <https://example.com/x>)の、c > d",
    );
  });

  test("インラインHTMLの属性の中のURLは触らない", () => {
    expect(
      wrapBareUrls('see <a href="https://example.com/x">x</a> and https://example.com/y'),
    ).toBe('see <a href="https://example.com/x">x</a> and <https://example.com/y>');
  });

  test("コードスパンの中のURLは触らない", () => {
    expect(wrapBareUrls("`https://example.com/x)の` と ``a `https://example.com/y` b`` と")).toBe(
      "`https://example.com/x)の` と ``a `https://example.com/y` b`` と",
    );
  });

  test("閉じないバッククォートは普通の文字として扱い、後続のURLは囲む", () => {
    expect(wrapBareUrls("` https://example.com/x)の")).toBe("` <https://example.com/x>)の");
  });

  test("フェンス付きコードブロックの中のURLは触らない", () => {
    const input = [
      "before https://example.com/a)の",
      "```ts",
      "const url = 'https://example.com/b)の';",
      "```",
      "after https://example.com/c)の",
      "  ~~~~",
      "https://example.com/d)の",
      "  ~~~~  ",
      "https://example.com/e)の",
    ].join("\n");
    expect(wrapBareUrls(input)).toBe(
      [
        "before <https://example.com/a>)の",
        "```ts",
        "const url = 'https://example.com/b)の';",
        "```",
        "after <https://example.com/c>)の",
        "  ~~~~",
        "https://example.com/d)の",
        "  ~~~~  ",
        "<https://example.com/e>)の",
      ].join("\n"),
    );
  });

  test("文書の先頭から始まるフェンスと、閉じられないフェンスも扱う", () => {
    expect(wrapBareUrls("```\nhttps://example.com/a)の\n```\nhttps://example.com/b)の")).toBe(
      "```\nhttps://example.com/a)の\n```\n<https://example.com/b>)の",
    );
    expect(wrapBareUrls("x\n```\nhttps://example.com/a)の\nhttps://example.com/b)の")).toBe(
      "x\n```\nhttps://example.com/a)の\nhttps://example.com/b)の",
    );
  });

  test("複数行にまたがるコードスパンの中のURLも触らない", () => {
    expect(wrapBareUrls("``\nhttps://example.com/a)の\n``")).toBe(
      "``\nhttps://example.com/a)の\n``",
    );
  });

  test("短すぎるフェンスはフェンスとして扱わない", () => {
    expect(wrapBareUrls("``\nhttps://example.com/a)の")).toBe("``\n<https://example.com/a>)の");
  });

  test("リスト項目の中で4個以上インデントされたフェンスの中のURLも触らない", () => {
    const input = [
      "1. 手順",
      "",
      "    ```sh",
      "    curl https://example.com/x)の",
      "    ```",
      "",
      "2. 次 https://example.com/y)の",
      "",
      "    ~~~",
      "    https://example.com/z)の",
      "    ~~~",
    ].join("\n");
    expect(wrapBareUrls(input)).toBe(
      [
        "1. 手順",
        "",
        "    ```sh",
        "    curl https://example.com/x)の",
        "    ```",
        "",
        "2. 次 <https://example.com/y>)の",
        "",
        "    ~~~",
        "    https://example.com/z)の",
        "    ~~~",
      ].join("\n"),
    );
  });

  test("引用の中のフェンスの中のURLも触らない", () => {
    const input = [
      "> ~~~",
      "> https://example.com/x)の",
      "> ~~~",
      "> https://example.com/y)の",
    ].join("\n");
    expect(wrapBareUrls(input)).toBe(
      ["> ~~~", "> https://example.com/x)の", "> ~~~", "> <https://example.com/y>)の"].join("\n"),
    );
  });

  test("HTMLブロックの中のURLは空行まで触らず、空行の後は囲む", () => {
    const input = [
      "<details>",
      "<summary>s</summary>",
      "https://example.com/x)の",
      "",
      "https://example.com/y)の",
      "",
      "</details>",
    ].join("\n");
    expect(wrapBareUrls(input)).toBe(
      [
        "<details>",
        "<summary>s</summary>",
        "https://example.com/x)の",
        "",
        "<https://example.com/y>)の",
        "",
        "</details>",
      ].join("\n"),
    );
  });

  test("行頭のインラインタグはHTMLブロックと取り違えず、後続のURLは囲む", () => {
    expect(wrapBareUrls("<kbd>Ctrl</kbd>を押すと https://example.com/x)の")).toBe(
      "<kbd>Ctrl</kbd>を押すと <https://example.com/x>)の",
    );
    expect(wrapBareUrls("本文\n<b>注意</b> https://example.com/x)の")).toBe(
      "本文\n<b>注意</b> <https://example.com/x>)の",
    );
  });

  test("行頭の<URL>はHTMLブロックと取り違えず、同じ段落の後続のURLは囲む", () => {
    expect(wrapBareUrls("<https://example.com/x> と https://example.com/y)の")).toBe(
      "<https://example.com/x> と <https://example.com/y>)の",
    );
  });

  test("インデントコードブロックはリストの続きの段落と区別しないため、中のURLも囲む", () => {
    // 4スペースのインデントはリスト項目の続きの段落にも使われ、
    // 入れ子の深さを追わずには区別できないので、意図して対象外にしています。
    expect(wrapBareUrls("本文\n\n    curl https://example.com/x)の")).toBe(
      "本文\n\n    curl <https://example.com/x>)の",
    );
  });

  test("スキームの無いwww.のURLは対象外なのでそのまま返す", () => {
    // GFMは`www.`も自動リンクにしますが、`<www...>`はCommonMarkの自動リンクにならないため扱えません。
    expect(wrapBareUrls("see www.example.com/xの変更点")).toBe("see www.example.com/xの変更点");
  });

  test("末尾の記号が大量に続いても例外にならず、URLの範囲だけを囲む", () => {
    // 本文はLLMの出力で、PRの内容によるプロンプトインジェクションの影響も受けます。
    // 記号1文字ごとに再帰するとコールスタックの上限を超えて`RangeError`になります。
    const parens = ")".repeat(50_000);

    expect(wrapBareUrls(`https://example.com/x${parens}`)).toBe(
      `<https://example.com/x>${parens}`,
    );
  });

  test("サロゲートペアを含む文章でも壊さない", () => {
    expect(wrapBareUrls("😀 https://example.com/x😀 と")).toBe("😀 <https://example.com/x>😀 と");
  });

  test("URLを含まない本文はそのまま返す", () => {
    const input = "line 1\n\n- item\n- `code`\n\n> quote";
    expect(wrapBareUrls(input)).toBe(input);
    expect(wrapBareUrls("")).toBe("");
  });

  test.each([
    "リリースノート(https://github.com/example/repo/releases/tag/v1.9.1)の変更点",
    "see https://example.com/x。次 https://example.com/y ok",
    "https://example.com/a_b_ と https://example.com/a. と https://example.com/y?!",
    "(https://example.com/x) と https://example.com/(a)) と https://en.wikipedia.org/wiki/Foo_(bar)",
    "https://example.com/x&amp; と https://example.com/y; と",
    "**https://example.com/x**と",
    "foohttps://example.com/x と ノートhttps://example.com/y と https:// と",
    "see <https://example.com/x>の後",
    "[https://example.com/x](https://example.com/x)の後 ![alt](https://example.com/a.png)",
    "[壊れたリンク](https://example.com/x の後 https://example.com/y)の",
    "> [!NOTE]\n> see https://example.com/x)の後 [x](y)",
    "a < b なので https://example.com/x)の、c > d",
    'see <a href="https://example.com/x">x</a> and https://example.com/y',
    "`https://example.com/x)の` と ` https://example.com/y)の",
    "```ts\nhttps://example.com/a)の\n```\nhttps://example.com/b)の",
    "> ~~~\n> https://example.com/x)の\n> ~~~\n> https://example.com/y)の",
    "<details>\nhttps://example.com/x)の\n\nhttps://example.com/y)の\n\n</details>",
    "<kbd>Ctrl</kbd>を押すと https://example.com/x)の",
    "😀 https://example.com/x😀 と",
  ])("冪等性: %j", (input) => {
    const once = wrapBareUrls(input);

    expect(wrapBareUrls(once)).toBe(once);
  });
});
