---
name: sops
description: Guidelines for handling secrets encrypted with sops. Never let decrypted plaintext reach the conversation; let sops decrypt and pass secrets to other processes via `exec-env` or `exec-file` instead, and leave editing to the user. Use when a repository contains `.sops.yaml`, a `secrets/` directory, sops-encrypted YAML/JSON/dotenv files, or an `.envrc` that loads secrets via sops.
user-invocable: false
---

# sopsで暗号化されたシークレットの取り扱い

復号した平文を会話に出さないでください。
会話のログはローカルの履歴ファイルやサービス側のサーバに残るので、
一度出力した平文は、後から暗号化し直しても漏れたままになります。

問題になるのは復号という操作そのものではなく、
平文がツールの結果やファイルの読み取りを通じて会話に入ることです。
sopsに復号させて、その結果を自分では見ずに別のプロセスへ直接渡すのは問題ありません。

自動モードのガードが`sops -d`などをブロックするのは正しい動作です。
ブロックされたら、同じ出力を別の手段で得ようとせず、平文を見ずに済む形へ組み替えてください。
組み替えても平文を見ないと目的を達成できないときにだけ、その作業をユーザに任せます。

## 禁止する操作

復号した結果が、標準出力やファイルやツールの結果として会話に入る操作は全て禁止です。
以下は代表例で、形を変えても同じです。

- `sops -d`、`sops --decrypt`、`sops decrypt`の出力をそのまま受け取る。
- `sops -d --extract '["key"]'`で一部だけを取り出す。
- `sops -d ... | grep`や`sops -d ... | jq`のように、パイプで一部だけを出す。
- `sops exec-env file 'env'`、`sops exec-env file 'printenv'`、`sops exec-file file 'cat {}'`のように、
  渡した先のコマンドで平文を出力する。
- 復号した結果を一時ファイルに書き出して`Read`する。
- PythonやNodeなど、別の言語やライブラリで復号する。
- direnvなどで既に環境変数に読み込まれている値を、
  `env`、`printenv`、`export -p`、`set`、`echo "$SECRET"`、`direnv export json`、`cat /proc/self/environ`で出力する。
  `env | grep`のような絞り込みも同じです。
- 平文の値を`.env`ファイルやソースコードやテストコードに書き込む。
- 平文のファイルをコミットする。

環境変数が設定されているかだけを知りたいときは、
`[ -n "${SECRET:-}" ] && echo set || echo unset`のように存在だけを確認します。

シークレットが正しいかを確かめたいときも、平文は出力しません。
長さやハッシュだけを出す工夫も不要です。
後述の`exec-env`でそのシークレットを実際に使うコマンドを実行し、
終了ステータスやエラーメッセージで判断してください。

## 平文を見ずにシークレットを使う

シークレットを必要とするコマンドは、sops公式ドキュメントの
[Passing Secrets to Other Processes](https://getsops.io/docs/usage/advanced/)
にある`exec-env`か`exec-file`を通して実行します。
復号はsopsが行い、平文は子プロセスにだけ渡されます。

- `sops exec-env file 'command'`: 復号した値を環境変数として子プロセスに渡します。
- `sops exec-file file 'command {}'`: 復号した内容をFIFO経由の一時ファイルとして渡します。
  `{}`がそのパスに置き換わります。

```console
sops exec-env secrets/env.yaml 'terraform plan'
sops exec-file secrets/kubeconfig.yaml 'kubectl --kubeconfig {} get pods'
```

渡した先のコマンドが、環境変数やファイルの中身を出力しないことを確認してください。
出力しないコマンドなら、ユーザに依頼せずに自分で実行して構いません。

`exec-env`に渡すファイルは、ネストのないフラットなキーと値だけで構成されている必要があります。
ネストしたマップやリストがあると、
`cannot use complex value in environment`のようなエラーで失敗します。

`sops -d file | command`のように復号結果をパイプで別のプロセスに渡す形も、
受け取る側が平文を出力しないなら原理的には同じです。
しかしガードは`sops -d`という文字列でブロックするので、`exec-file`で書くほうが確実です。

## 許可される操作

暗号化されたファイルそのものは読んで構いません。
sopsはキー名と構造を平文のまま残し、値だけを`ENC[AES256_GCM,...]`の形で暗号化するためです。
どのキーがあるか、どの鍵で暗号化されているかは、`Read`ツールや`yq`で確認できます。
ファイル末尾の`sops`セクションにあるメタデータ
(`pgp`、`age`、`kms`などの受信者の一覧、`lastmodified`、`mac`、`version`)も秘密ではありません。

平文を出力しないコマンドも使って構いません。

- `sops filestatus file`: ファイルが暗号化されているかを確認します。
- `sops updatekeys file`: `.sops.yaml`の鍵の変更をファイルに反映します。
- `sops rotate -i file`: データキーをローテーションします。
- `sops unset file '["key"]'`: キーを削除します。
- `sops -e -i file`: ユーザが用意した平文ファイルをその場で暗号化します。
  暗号化する前のファイルは`Read`しません。

`.sops.yaml`の`creation_rules`や`key_groups`は、通常の設定ファイルと同じように編集できます。
受信者の鍵を変えた後は`sops updatekeys`が必要です。

## 値の追加や変更

`sops file`や`sops edit file`は対話的にエディタを開くので、自分では実行できません。
値の追加や変更が必要なときは、ユーザにエディタでの編集を依頼してください。
Claude Codeでは、`! sops secrets/foo.yaml`のように`!`プレフィックスを付けると、
ユーザ自身がコマンドを実行できます。

ユーザが会話の中で既に値を示している場合に限り、
`sops set file '["key"]' '"value"'`で非対話的に書き込んで構いません。
値はJSONとして解釈されるので、文字列は二重引用符で囲みます。
ユーザが値を平文ファイルに用意した場合は、
`sops set --value-file path file '["key"]'`でそのファイルから読み込めます。
このときも平文ファイルは`Read`しません。

シークレットを新しく作る場合も、平文の内容を考えるのはユーザです。
自分が用意するのは、キー名の提案と、暗号化後のファイルを参照する設定の側だけです。

## .envrcからの読み込み

direnvでシークレットを環境変数に読み込むときは、
平文のファイルをディスクに置かず、sopsから直接読み込みます。
direnv公式wikiの
[Sops](https://github.com/direnv/direnv/wiki/Sops)
に載っている以下の形に従ってください。

```bash
# .envrc
use_sops() {
  local path=${1:-$PWD/secrets.yaml}
  eval "$(sops -d --output-type dotenv "$path" | direnv dotenv bash /dev/stdin)"
  watch_file "$path"
}

use sops secrets/env.yaml
```

- `export`文は`sed`などで自前で組み立てず、`direnv dotenv bash`に変換させます。
  値を正しくクォートした`export`文になるためです。
- 読み込むファイルは、`exec-env`と同じくフラットなキーと値だけで構成します。
  ネストがあると、`--output-type dotenv`が`cannot use complex value in dotenv file`で失敗します。
- `.env`形式のファイルを暗号化するときは、`--input-type dotenv --output-type dotenv`を明示します。
  sopsは`.env`以外のファイル名をdotenvとして認識しないためです。

`.envrc`自体の編集やレビューは問題ありません。
ただし復号はdirenvがシェルの起動時に行うものです。
`.envrc`の中の復号コマンドを自分で単独で実行すると、平文が会話に出ます。

## Nix向けの統合

sops-nixなどのNix向けの統合では、
各Nixモジュールの`sops.secrets.*`の宣言を編集する範囲で作業します。
平文を出力しない点は同じです。
