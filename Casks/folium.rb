cask "folium" do
  arch arm: "arm64", intel: "x64"

  version "0.1.0"
  sha256 arm:   "98fbbcb5ed0c7c0c8025309d3c7ff5c0b21e649ca9855689be09a99da1fefd54",
         intel: "c569367ca972a011bda8b32d8cac087e22ef2df08b7293f18fbdf0e4f08f8439"

  url "https://github.com/mveselovski/folium/releases/download/v#{version}/Folium-#{version}-#{arch}.dmg"
  name "Folium"
  desc "Local document browser for md, docx, xlsx, csv, html and txt files"
  homepage "https://github.com/mveselovski/folium"

  depends_on macos: :ventura

  app "Folium.app"

  zap trash: [
    "~/Library/Caches/io.github.mveselovski.folium",
    "~/Library/HTTPStorages/io.github.mveselovski.folium",
    "~/Library/Preferences/io.github.mveselovski.folium.plist",
    "~/Library/Saved Application State/io.github.mveselovski.folium.savedState",
    "~/Library/WebKit/io.github.mveselovski.folium",
  ]
end
