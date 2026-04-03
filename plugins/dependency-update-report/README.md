# dependency-update-report

依存関係の更新内容とプロジェクトへの影響を調査・報告するClaude Codeプラグインです。

変更の調査、
リンターの実行、
コードベースへの影響評価を行い、
Markdownレポートを作成します。

## インストール

このプラグインをインストールする前に、[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install dependency-update-report@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "dependency-update-report@konoka": true
  }
}
```

## 使い方

Claude Codeで`/dependency-update-report`スキルを呼び出してください。

プロジェクトのリンター実行時に、
allowed-toolsに含まれないコマンドの場合は承認が必要になることがあります。

GitHub MCPはユーザーの環境に設定されている場合のみ利用されます。
設定されていない場合はWeb検索等で代替されます。

## ライセンス

Apache-2.0
