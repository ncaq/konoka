---
name: sops
description: Guidelines for handling secrets encrypted with sops. Never let decrypted plaintext reach the conversation; let sops decrypt and pass secrets to other processes via `exec-env` or `exec-file` instead, and leave editing to the user. Use when a repository contains `.sops.yaml`, a `secrets/` directory, sops-encrypted YAML/JSON/dotenv files, or an `.envrc` that loads secrets via sops.
user-invocable: false
---

# sopsで暗号化されたシークレットの取り扱い

## 原則

復号した平文を会話に出さないでください。

AIコーディングアシスタントの会話ログは、
ローカルの履歴ファイルやサービス側のサーバに残ります。
一度平文を出力してしまうと、
その後に暗号化し直しても漏れた事実は消えません。

問題なのは復号という操作そのものではなく、
平文がツールの結果やファイルの読み取りを通じて会話に入ることです。
sopsに復号させて、
その結果をアシスタントが見ることなく別のプロセスへ直接渡すのであれば問題ありません。

自動モードのガードが`sops -d`などをブロックするのは正しい動作です。
ブロックされたら同じ出力を別の手段で得ようとせず、
平文を見ずに済む形へ組み替えてください。
組み替えても平文を見ないと目的を達成できない時にだけ、
その作業を人間に任せてください。

## 禁止

復号した結果が標準出力やファイルやツールの結果として会話に流れ込む操作は全て禁止です。
以下は代表例であり、
形を変えても同じことです。

- `sops -d`, `sops --decrypt`, `sops decrypt`の出力をそのまま受け取る
- `sops -d --extract '["key"]'`のような部分的な取り出し
- `sops exec-env file 'env'`や`sops exec-env file 'printenv'`や`sops exec-file file 'cat {}'`のように、渡した先のコマンドで平文を出力する
- 復号結果を一時ファイルへ書き出して`Read`する
- `sops -d ... | grep`や`sops -d ... | jq`のようにパイプで一部だけ出す
- 復号をPythonやNodeなど別の言語やライブラリで行う
- direnvなどで既に環境変数として読み込まれている場合に`env`, `printenv`, `export -p`, `set`, `echo "$SECRET"`, `direnv export json`, `cat /proc/self/environ`で出力する
- 平文の値を`.env`ファイルやソースコードやテストコードへ書き込む
- 平文のファイルをコミットする

「このシークレットが正しいか確認したい」という目的でも平文を出力しないでください。
長さやハッシュだけを出す工夫も不要です。
後述の`exec-env`で実際に使うコマンドを実行し、
終了ステータスやエラーメッセージで判断してください。

## 平文を見ずにシークレットを使う

シークレットを必要とするコマンドを実行したい時は、
sops公式ドキュメントの
[Passing Secrets to Other Processes](https://getsops.io/docs/usage/advanced/)
にある`exec-env`と`exec-file`を使ってください。
復号はsopsが行い、
平文は子プロセスにだけ渡されます。

- `sops exec-env file 'command'`: 復号した値を環境変数として子プロセスへ渡す
- `sops exec-file file 'command {}'`: 復号した内容をFIFO経由の一時ファイルとして渡す。`{}`がそのパスに置き換わる

```console
sops exec-env secrets/env.yaml 'terraform plan'
sops exec-file secrets/kubeconfig.yaml 'kubectl --kubeconfig {} get pods'
```

渡した先のコマンドが環境変数やファイルの中身を出力しないことだけ確認してください。
出力しないコマンドであれば、
人間に依頼せずにアシスタントが実行して構いません。

`sops -d file | command`のように復号結果をパイプで別のプロセスへ渡す形も、
受け取る側が平文を出力しないなら原理的には同じです。
しかしガードは`sops -d`の文字列でブロックするため、
`exec-file`で書き直す方が確実です。

`exec-env`は環境変数の都合上、
ファイルがネストのないフラットなキーと値で構成されている必要があります。
ネストしたマップやリストがあると
`cannot use complex value in environment`
のようなエラーで失敗します。

## 許可

暗号化されたファイルそのものを読むことは問題ありません。
sopsはキー名と構造を平文のまま残し、
値だけを`ENC[AES256_GCM,...]`の形で暗号化しています。
どのキーが存在するかや、
どの鍵で暗号化されているかは`Read`ツールや`yq`で確認できます。

ファイル末尾の`sops`セクションにはメタデータがあります。

- `pgp`, `age`, `kms`などの受信者一覧
- `lastmodified`
- `mac`
- `version`

これらは秘密ではありません。

平文を出力しないコマンドも使って構いません。

- `sops filestatus file`: ファイルが暗号化されているか確認する
- `sops updatekeys file`: `.sops.yaml`の鍵変更をファイルへ反映する
- `sops rotate -i file`: データキーをローテーションする
- `sops unset file '["key"]'`: キーを削除する
- `sops -e -i file`: 人間が用意した平文ファイルをその場で暗号化する。ただし暗号化前のファイルを`Read`しないでください

`.sops.yaml`の`creation_rules`や`key_groups`の編集も通常の設定ファイルと同じ扱いです。
ただし受信者の鍵を変えた後は`sops updatekeys`が必要です。

## 値の追加や変更

`sops file`や`sops edit file`は対話的にエディタを開くため、
AIコーディングアシスタントからは実行できません。

値の追加や変更が必要になった時は、
ユーザーにエディタでの編集を依頼してください。
Claude Codeでは`! sops secrets/foo.yaml`のように、
`!`プレフィックスでユーザーがコマンドを自分で実行できます。

ユーザーが会話の中で既に値を提示している場合に限り、
`sops set file '["key"]' '"value"'`で非対話的に書き込んで構いません。
値はJSONとして解釈されるため、
文字列は二重引用符で囲む必要があります。
ユーザーが値を平文ファイルに用意してくれた場合は、
`sops set --value-file path file '["key"]'`でそのファイルから読み込めます。
この時も平文ファイルを`Read`してはいけません。

シークレットを新規に作る場合も、
平文の内容を考えるのは人間の仕事です。
アシスタントが用意するのはキー名の提案と、
暗号化後のファイルを参照する設定の側だけです。

## .envrcからの読み込み

direnvで環境変数としてシークレットを読み込む場合、
平文のファイルをディスクへ置かずにsopsから直接読み込みます。
direnv公式wikiの
[Sops](https://github.com/direnv/direnv/wiki/Sops)
に載っているパターンに従ってください。

```bash
# .envrc
use_sops() {
  local path=${1:-$PWD/secrets.yaml}
  eval "$(sops -d --output-type dotenv "$path" | direnv dotenv bash /dev/stdin)"
  watch_file "$path"
}

use sops secrets/env.yaml
```

`direnv dotenv bash`は値を適切にクォートした`export`文へ変換します。
`sed`などで自前の`export`を組み立てないでください。
`watch_file`により暗号化ファイルの更新で自動的に再読み込みされます。

`exec-env`と同じく、
このファイルはフラットなキーと値だけで構成してください。
`--output-type dotenv`はネストがあると
`cannot use complex value in dotenv file`
で失敗します。

`.env`形式のファイルを暗号化する時は、
`--input-type dotenv --output-type dotenv`を明示してください。
sopsは`.env`以外のファイル名をdotenvとして認識しません。

この`.envrc`自体の編集やレビューは問題ありません。
しかし復号はdirenvがシェル起動時に行うものであり、
`.envrc`の中の復号コマンドをアシスタントが単独で実行すると平文が会話に出ます。

direnvで読み込み済みのシェルで作業する時は、
環境変数の中身を出力する操作をしないよう注意してください。
`env | grep`のような絞り込みも同様です。
変数が設定されているかどうかだけを知りたい時は、
`[ -n "${SECRET:-}" ] && echo set || echo unset`のように存在だけを確認してください。

## 関連

sops-nixなどNix向けの統合については、
各Nixモジュールの`sops.secrets.*`宣言を編集する範囲で作業し、
平文を出力しない点は同じです。
