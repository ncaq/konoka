# konokaのビルド済みプラグインをhome-manager経由でAIコーディングアシスタントへ接続するモジュール。
# `konokaFlake`にはこのリポジトリのflake(self)を渡す。
{ konokaFlake }:
{
  lib,
  pkgs,
  options,
  config,
  ...
}:
let
  cfg = config.konoka;

  konokaPackages = konokaFlake.packages.${pkgs.stdenv.hostPlatform.system};

  # `plugins/`直下のディレクトリ名をそのままプラグイン名として使う。
  # flake.nixのパッケージ導出と同じ方針で、
  # プラグインの追加削除にこの一覧を手動追随させる必要をなくす。
  pluginNames = lib.attrNames (
    lib.filterAttrs (_name: type: type == "directory") (builtins.readDir ../plugins)
  );

  # プラグイン名からビルド済みパッケージへの辞書。
  plugins = lib.genAttrs pluginNames (pluginName: konokaPackages.${pluginName});

  # skillsを持つプラグインの名前リスト。
  # `skills/`ディレクトリの有無で判定するため、
  # hookのみで構成されるプラグイン(例: rm-to-trash)は自動的に除外される。
  skillPluginNames = lib.filter (
    pluginName: builtins.pathExists (../plugins + "/${pluginName}/skills")
  ) pluginNames;

  # 各プラグイン内のskillsサブディレクトリをフラットに展開する。
  # パスにはビルド済みパッケージ側ではなくソース側を参照する。
  # home-managerのopencodeモジュールはパスの種別判定のために評価時にパスを読むので、
  # パッケージ側を参照すると評価時にビルドが必要になり、
  # 別システム向けの構成をビルドなしで評価出来なくなるため。
  # ヘルパースクリプトのビルド生成物はプラグインルート直下にありスキルディレクトリには含まれず、
  # スキルの埋め込みコマンドは`extraPackages`によるPATH経由で解決されるため、
  # ソース側を参照しても機能は欠けない。
  skillEntries = lib.concatMap (
    pluginName:
    map (skillName: {
      inherit pluginName skillName;
      path = ../plugins + "/${pluginName}/skills/${skillName}";
    }) (lib.attrNames (builtins.readDir (../plugins + "/${pluginName}/skills")))
  ) skillPluginNames;

  # スキル名からそれを提供するプラグイン名のリストへの辞書。
  # 複数プラグインが同名のスキルを持つとフラット展開時に片方が消えるため、
  # 検出できるように所有者一覧を組み立てる。
  skillOwners = lib.foldl' (
    acc: entry:
    acc
    // {
      ${entry.skillName} = (acc.${entry.skillName} or [ ]) ++ [ entry.pluginName ];
    }
  ) { } skillEntries;

  skillNameConflicts = lib.filterAttrs (_skillName: owners: 1 < lib.length owners) skillOwners;

  skills =
    assert lib.assertMsg (
      skillNameConflicts == { }
    ) "konokaプラグイン間でスキル名が衝突しています: ${builtins.toJSON skillNameConflicts}";
    lib.listToAttrs (map (entry: lib.nameValuePair entry.skillName entry.path) skillEntries);
in
{
  options.konoka = {
    claude-code.enable = lib.mkEnableOption "loading konoka plugins into Claude Code";
    opencode.enable = lib.mkEnableOption "loading konoka skills into OpenCode";
  };

  config = lib.mkMerge [
    (lib.mkIf cfg.claude-code.enable {
      # home-managerのrelease-26.05では`plugins`はリスト型のみを受け付けるが、
      # それより新しいhome-managerでは属性セット型が推奨でリスト型は非推奨のため、
      # オプションの型を見てどちらの形式で渡すか切り替える。
      programs.claude-code.plugins =
        if options.programs.claude-code.plugins.type.name == "listOf" then
          lib.attrValues plugins
        else
          plugins;
    })
    (lib.mkIf cfg.opencode.enable {
      programs.opencode = {
        # スキルは`~/.config/opencode/skills/<skill>/`へそれぞれsymlinkされる。
        inherit skills;
        # スキルの埋め込みコマンド(`commit-prepare`など)を呼び出せるように、
        # OpenCodeプロセスのPATHへプラグインの`bin/`を追加する。
        # `bin/`を持たないプラグインが混ざっても`makeBinPath`が単に空を返すだけで害はないため、
        # 対象を絞らず全プラグインをまとめて渡す。
        extraPackages = lib.attrValues plugins;
      };
    })
  ];
}
