{
  lib,
  rustPlatform,
  fetchCrate,
}:
let
  version = "0.44.0";
in
rustPlatform.buildRustPackage {
  pname = "agnix";
  inherit version;

  src = fetchCrate {
    pname = "agnix-cli";
    inherit version;
    hash = "sha256-ULnJMdd48/i8nebM73eOKb3j2Ep5nbxBju3+b96Cy1s=";
  };

  cargoHash = "sha256-+ZzDyu/71AWI2eYDGKLN8fwE5fSX7epaZDrZ/ZwPEpg=";

  # crates.ioのソースには統合テスト用のフィクスチャが含まれないためスキップ。
  doCheck = false;

  meta = {
    description = "The missing linter and LSP for AI coding assistants";
    homepage = "https://github.com/agent-sh/agnix";
    license = with lib.licenses; [
      mit
      asl20
    ];
    mainProgram = "agnix";
  };
}
