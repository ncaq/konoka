{
  lib,
  rustPlatform,
  fetchCrate,
}:

rustPlatform.buildRustPackage {
  pname = "agnix";
  version = "0.17.0";

  src = fetchCrate {
    pname = "agnix-cli";
    version = "0.17.0";
    hash = "sha256-8aVeSGG1/fs2SFlt6PrFVwJSmmVD4x5w2Rv58QyBWVk=";
  };

  cargoHash = "sha256-rdtUCA3wBC+IUtKVseRsLwIDjvfJDA5Vi6gx8l8U8Mg=";

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
