{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-parts.url = "github:hercules-ci/flake-parts";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{
      nixpkgs,
      flake-parts,
      treefmt-nix,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        treefmt-nix.flakeModule
      ];

      systems = [
        "aarch64-linux"
        "x86_64-linux"
      ];

      perSystem =
        {
          lib,
          system,
          ...
        }:
        let
          pkgs = import nixpkgs {
            inherit system;
            config.allowUnfreePredicate =
              pkg:
              builtins.elem (lib.getName pkg) [
                # konokaは今はclaude-code向けのプラグインを作っているリポジトリなので、
                # claude-code系への依存関係が発生しても今更問題になる話ではありません。
                # 仕方なくプロプライエタリなソフトウェアを受け入れています。
                "claude-code"
              ];
          };
          inherit (pkgs) nodejs;

          # plugins/配下の実ディレクトリからプラグイン一覧を導出する。
          # ビルド設定ファイルの有無で種別を判定するため、
          # プラグインを追加してもここに手動で一覧を追記する必要はなく、
          # パッケージ化やチェックからの漏れも起きない。
          pluginDirOf = pluginName: ./plugins + "/${pluginName}";
          pluginNames = lib.attrNames (
            lib.filterAttrs (_name: type: type == "directory") (builtins.readDir ./plugins)
          );
          npmPluginNames = lib.filter (
            pluginName: builtins.pathExists (pluginDirOf pluginName + "/package.json")
          ) pluginNames;
          rustPluginNames = lib.filter (
            pluginName: builtins.pathExists (pluginDirOf pluginName + "/Cargo.toml")
          ) pluginNames;
          staticPluginNames = lib.subtractLists (npmPluginNames ++ rustPluginNames) pluginNames;

          # プラグインディレクトリのpackage.json/package-lock.jsonからnode_modulesを構築する。
          mkNodeModules =
            pluginDir:
            pkgs.importNpmLock.buildNodeModules {
              inherit nodejs;
              npmRoot = lib.fileset.toSource {
                root = pluginDir;
                fileset = lib.fileset.unions [
                  (pluginDir + "/package.json")
                  (pluginDir + "/package-lock.json")
                ];
              };
              derivationArgs = {
                # `importNpmLock`は`npm install --ignore-scripts`で依存を展開するため、
                # rootパッケージのprepareスクリプトが実行されない。
                # `effect-language-service patch`がtscにパッチを当てて、
                # effect診断をtscの診断の一部として有効化するパッケージがあるため、
                # `node_modules`がまだ書き込み可能なこの段階でprepareを実行する。
                preInstall = ''
                  npm run --if-present prepare
                '';
              };
            };

          # プラグインディレクトリのリストから全npmチェックのattrsetを生成する。
          pluginNpmChecks =
            let
              scriptList = [
                "lint:eslint"
                "lint:tsc"
                "test"
              ];
              mkPluginChecks =
                pluginDir:
                let
                  pluginName = builtins.baseNameOf pluginDir;
                  nodeModules = mkNodeModules pluginDir;
                  tsRoot = lib.fileset.toSource {
                    root = ./.;
                    fileset = lib.fileset.unions [
                      ./.editorconfig
                      ./.gitignore
                      pluginDir
                    ];
                  };
                  mkCheck =
                    script:
                    let
                      checkName = "${builtins.replaceStrings [ ":" ] [ "-" ] script}-${pluginName}";
                    in
                    lib.nameValuePair checkName (
                      pkgs.runCommand checkName
                        {
                          nativeBuildInputs = [
                            nodejs
                            pkgs.claude-code
                            pkgs.git
                          ];
                        }
                        ''
                          cp -r ${tsRoot}/. .
                          # nix storeから複製したファイル/ディレクトリはread-onlyのため、
                          # 書き込みを伴うツールが動くように書き込み権限を付与する。
                          # viteのconfig bundleやvitestのキャッシュ書き出しなどが該当する。
                          chmod -R u+w $NIX_BUILD_TOP
                          ln -s ${nodeModules}/node_modules node_modules
                          cd plugins/${pluginName}
                          npm run ${script}
                          touch $out
                        ''
                    );
                in
                lib.listToAttrs (map mkCheck scriptList);
            in
            lib.foldl' lib.mergeAttrs { } (
              map (pluginName: mkPluginChecks (pluginDirOf pluginName)) npmPluginNames
            );

          # プラグインディレクトリのリストから全Rustチェックのattrsetを生成する。
          pluginRustChecks =
            let
              scriptList = [
                {
                  name = "cargo-clippy";
                  script = "cargo clippy --all-targets --frozen -- -D warnings";
                  extraInputs = with pkgs; [ clippy ];
                }
                {
                  # treefmtでも整形チェックは行えるが、
                  # プロジェクト固有の設定をこちらのほうが読み込みやすい。
                  name = "cargo-fmt";
                  script = "cargo fmt --all --check";
                  extraInputs = with pkgs; [ rustfmt ];
                }
                {
                  name = "cargo-test";
                  script = "cargo test --frozen";
                  extraInputs = [ ];
                }
              ];
              mkPluginChecks =
                pluginDir:
                let
                  pluginName = builtins.baseNameOf pluginDir;
                  rustSrc = lib.fileset.toSource {
                    root = ./.;
                    fileset = lib.fileset.unions [
                      (pluginDir + "/Cargo.lock")
                      (pluginDir + "/Cargo.toml")
                      (pluginDir + "/src")
                    ];
                  };
                  cargoDeps = pkgs.rustPlatform.importCargoLock {
                    lockFile = pluginDir + "/Cargo.lock";
                  };
                  mkCheck =
                    {
                      name,
                      script,
                      extraInputs,
                    }:
                    let
                      checkName = "${name}-${pluginName}";
                    in
                    lib.nameValuePair checkName (
                      pkgs.stdenv.mkDerivation {
                        name = checkName;
                        src = rustSrc;
                        sourceRoot = "source/plugins/${pluginName}";
                        inherit cargoDeps;
                        nativeBuildInputs =
                          with pkgs;
                          [
                            cargo
                            rustPlatform.cargoSetupHook
                            rustc
                          ]
                          ++ extraInputs;
                        buildPhase = ''
                          runHook preBuild
                          ${script}
                          runHook postBuild
                        '';
                        postBuild = ''
                          touch $out
                        '';
                        doCheck = false;
                        dontInstall = true;
                      }
                    );
                in
                lib.listToAttrs (map mkCheck scriptList);
            in
            lib.foldl' lib.mergeAttrs { } (
              map (pluginName: mkPluginChecks (pluginDirOf pluginName)) rustPluginNames
            );

          # プラグインのビルド済みパッケージ群。
          # nix store上のプラグインは読み込み専用でランタイムビルドが出来ないため、
          # ヘルパースクリプトのビルド生成物まで含めた完全なプラグインを提供する。
          pluginPackages =
            let
              pluginVersionOf =
                pluginName: (lib.importJSON (pluginDirOf pluginName + /.claude-plugin/plugin.json)).version;
              # ランタイムビルドの生成物と依存の展開先を除いたプラグインソース。
              pluginSourceOf =
                pluginName:
                let
                  pluginDir = pluginDirOf pluginName;
                in
                lib.fileset.toSource {
                  root = pluginDir;
                  fileset = lib.fileset.difference pluginDir (
                    lib.fileset.unions (
                      map (name: lib.fileset.maybeMissing (pluginDir + "/${name}")) [
                        ".build.lock"
                        "dist"
                        "node_modules"
                        "target"
                      ]
                    )
                  );
                };
              # ビルド不要のプラグインをそのままパッケージ化する。
              mkStaticPlugin =
                pluginName:
                pkgs.stdenv.mkDerivation {
                  pname = "konoka-plugin-${pluginName}";
                  version = pluginVersionOf pluginName;
                  src = pluginSourceOf pluginName;
                  installPhase = ''
                    runHook preInstall
                    cp -r . $out
                    runHook postInstall
                  '';
                };
              # TypeScript製ヘルパーをビルドしてdistを同梱する。
              mkNpmPlugin =
                pluginName:
                let
                  nodeModules = mkNodeModules (pluginDirOf pluginName);
                in
                pkgs.stdenv.mkDerivation {
                  pname = "konoka-plugin-${pluginName}";
                  version = pluginVersionOf pluginName;
                  src = pluginSourceOf pluginName;
                  nativeBuildInputs = [
                    nodejs
                    pkgs.makeWrapper
                  ];
                  buildPhase = ''
                    runHook preBuild
                    ln -s ${nodeModules}/node_modules node_modules
                    npm run build
                    runHook postBuild
                  '';
                  installPhase = ''
                    runHook preInstall
                    rm node_modules
                    cp -r . $out
                    runHook postInstall
                  '';
                  # binのスクリプトはnodeをPATHから探すため、
                  # スクリプト本体は無改変のままラップしてランタイム依存としてnodeを付与する。
                  postInstall = ''
                    if [ -d "$out/bin" ]; then
                      for script in "$out"/bin/*; do
                        wrapProgram "$script" --prefix PATH : ${lib.makeBinPath [ nodejs ]}
                      done
                    fi
                  '';
                };
              # Rust製フックバイナリをビルドしてtarget/releaseに同梱する。
              mkRustPlugin =
                pluginName:
                pkgs.stdenv.mkDerivation {
                  pname = "konoka-plugin-${pluginName}";
                  version = pluginVersionOf pluginName;
                  src = pluginSourceOf pluginName;
                  cargoDeps = pkgs.rustPlatform.importCargoLock {
                    lockFile = pluginDirOf pluginName + "/Cargo.lock";
                  };
                  nativeBuildInputs = with pkgs; [
                    cargo
                    rustPlatform.cargoSetupHook
                    rustc
                  ];
                  # `.cargo/config.toml`の`target-cpu=native`はビルドしたマシンでのみ実行する前提の最適化だが、
                  # このパッケージはバイナリキャッシュ経由で別CPUのマシンにも配布され得るため、
                  # 最高優先度の`RUSTFLAGS`で汎用的なCPU水準に上書きする。
                  # x86_64はClaude Codeが動作する程度のCPUを前提としてx86-64-v3に抑える。
                  env.RUSTFLAGS =
                    if pkgs.stdenv.hostPlatform.isx86_64 then "-C target-cpu=x86-64-v3" else "-C target-cpu=generic";
                  buildPhase = ''
                    runHook preBuild
                    cargo build --release --frozen
                    runHook postBuild
                  '';
                  # hooks.jsonが参照するパスに合わせてバイナリだけをtarget/releaseへ残し、
                  # その他のビルド生成物と`cargoSetupHook`の設定は除外する。
                  installPhase = ''
                    runHook preInstall
                    cp -r . $out
                    rm -rf $out/.cargo $out/target
                    install -Dm755 target/release/${pluginName} $out/target/release/${pluginName}
                    runHook postInstall
                  '';
                };
            in
            lib.genAttrs staticPluginNames mkStaticPlugin
            // lib.genAttrs npmPluginNames mkNpmPlugin
            // lib.genAttrs rustPluginNames mkRustPlugin;

          # マーケットプレイス全体をビルド済みプラグインで構成したパッケージ。
          # `/plugin marketplace add <storeパス>`でそのまま利用できる。
          konoka-marketplace =
            let
              marketplace = lib.importJSON ./.claude-plugin/marketplace.json;
              marketplacePluginNames = lib.sort lib.lessThan (map (plugin: plugin.name) marketplace.plugins);
            in
            # plugins/のディレクトリ一覧とmarketplace.jsonの登録内容の齟齬を評価時に検出する。
            assert lib.assertMsg (
              marketplacePluginNames == pluginNames
            ) "marketplace.jsonのプラグイン一覧がplugins/のディレクトリ一覧と一致しません";
            pkgs.runCommand "konoka-${marketplace.metadata.version}" { } ''
              mkdir -p $out/.claude-plugin $out/plugins
              cp ${./.claude-plugin/marketplace.json} $out/.claude-plugin/marketplace.json
              ${lib.concatStrings (
                lib.mapAttrsToList (pluginName: plugin: ''
                  ln -s ${plugin} $out/plugins/${pluginName}
                '') pluginPackages
              )}
            '';

          agnix = pkgs.callPackage ./pkgs/agnix/package.nix { };

          agnixSrc = lib.fileset.toSource {
            root = ./.;
            fileset = lib.fileset.unions [
              ./.claude
              ./.claude-plugin
              ./.github
              ./plugins

              ./.agnix.toml
              ./AGENTS.md
              ./CLAUDE.md
            ];
          };
        in
        {
          treefmt.config = {
            projectRootFile = "flake.nix";
            programs = {
              actionlint.enable = true;
              deadnix.enable = true;
              nixfmt.enable = true;
              prettier.enable = true;
              shellcheck.enable = true;
              shfmt.enable = true;
              statix.enable = true;
              typos.enable = true;
              zizmor.enable = true;
            };
            settings.formatter = {
              editorconfig-checker = {
                command = pkgs.editorconfig-checker;
                includes = [ "*" ];
              };
              zizmor.options = [ "--pedantic" ];
            };
          };

          checks = {
            lint-agnix =
              pkgs.runCommand "lint-agnix"
                {
                  nativeBuildInputs = [ agnix ];
                }
                ''
                  cp -r ${agnixSrc}/. .
                  agnix --strict
                  touch $out
                '';
          }
          // pluginNpmChecks
          // pluginRustChecks
          # プラグインパッケージのビルドもチェック対象に含める。
          // lib.mapAttrs' (pluginName: lib.nameValuePair "package-${pluginName}") (
            pluginPackages // { konoka = konoka-marketplace; }
          );

          packages = {
            # flake.lockの管理バージョンをre-exportすることで安定した利用を促進。
            inherit (pkgs)
              nix-fast-build
              ;
            default = konoka-marketplace;
          }
          // pluginPackages;

          devShells.default = pkgs.mkShell {
            buildInputs = with pkgs; [
              # treefmtで指定したプログラムの単体版。
              actionlint
              deadnix
              editorconfig-checker
              nixfmt
              prettier
              shellcheck
              shfmt
              statix
              typos
              zizmor

              # nixの関連ツール。
              nix-fast-build

              # Node.js
              nodejs

              # Rust toolchain (rm-to-trashのフックバイナリ用)
              cargo
              clippy
              rust-analyzer
              rustc
              rustfmt

              # AIコーディングアシスタント設定のリンター。
              agnix
            ];
          };
        };
    };

  nixConfig = {
    extra-substituters = [
      "https://cache.nixos.org/"
      "https://niks3-public.ncaq.net/"
      "https://ncaq.cachix.org/"
      "https://nix-community.cachix.org/"
    ];
    extra-trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "niks3-public.ncaq.net-1:e/B9GomqDchMBmx3IW/TMQDF8sjUCQzEofKhpehXl04="
      "ncaq.cachix.org-1:XF346GXI2n77SB5Yzqwhdfo7r0nFcZBaHsiiMOEljiE="
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
  };
}
