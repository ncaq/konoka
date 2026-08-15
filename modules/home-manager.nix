# konokaのビルド済みプラグインをhome-manager経由でAIコーディングアシスタントへ接続するモジュール。
# `konokaFlake`にはこのリポジトリのflake(self)を、
# `pluginNames`にはflake.nixが導出したプラグイン名の一覧を渡す。
# パッケージの導出と同じ一覧を受け取ることで、
# 存在しないパッケージ名を参照する齟齬を防ぐ。
{ konokaFlake, pluginNames }:
{
  lib,
  pkgs,
  options,
  config,
  ...
}:
let
  cfg = config.konoka;

  # 未対応システムでは属性欠落の分かりにくいエラーではなく、
  # 対応システムが分かるメッセージで失敗させる。
  konokaPackages =
    let
      inherit (pkgs.stdenv.hostPlatform) system;
    in
    assert lib.assertMsg (konokaFlake.packages ? ${system})
      "konokaはシステム${system}に対応していません。対応システム: ${lib.concatStringsSep ", " (lib.attrNames konokaFlake.packages)}";
    konokaFlake.packages.${system};

  # プラグイン名からビルド済みパッケージへの辞書。
  plugins = lib.getAttrs pluginNames konokaPackages;

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
      # 属性セット型が推奨の新しいhome-managerと、
      # リスト型のみを受け付ける古いhome-managerの両方に対応するため、
      # 属性セットのまま受理されるかをオプションの型に問い合わせて渡す形式を決める。
      programs.claude-code.plugins =
        if options.programs.claude-code.plugins.type.check plugins then plugins else lib.attrValues plugins;
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
