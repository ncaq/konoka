{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
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
                "claude-code-bin"
              ];
          };
          nodejs = pkgs.nodejs_24;

          # プラグインディレクトリのリストから全チェックのattrsetを生成する。
          pluginChecks =
            let
              scriptList = [
                "lint:eslint"
                "lint:prettier"
                "lint:tsc"
                "test"
              ];
              mkPluginChecks =
                pluginDir:
                let
                  pluginName = builtins.baseNameOf pluginDir;
                  npmRoot = lib.fileset.toSource {
                    root = pluginDir;
                    fileset = lib.fileset.unions [
                      (pluginDir + "/package.json")
                      (pluginDir + "/package-lock.json")
                    ];
                  };
                  nodeModules = pkgs.importNpmLock.buildNodeModules {
                    inherit nodejs npmRoot;
                  };
                  tsSrc = lib.fileset.toSource {
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
                            pkgs.claude-code-bin
                            pkgs.git
                          ];
                        }
                        ''
                          cp -r ${tsSrc}/. .
                          # nix storeから複製したファイル/ディレクトリはread-onlyのため、
                          # 書き込みを伴うツール(viteのconfig bundleやvitestのキャッシュ書き出しなど)が、
                          # 動くように書き込み権限を付与する。
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
              map mkPluginChecks [
                ./plugins/commit
                ./plugins/kyosei
              ]
            );

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
          // pluginChecks;

          packages = {
            # flake.lockの管理バージョンをre-exportすることで安定した利用を促進。
            inherit (pkgs)
              nix-fast-build
              ;
          };
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
