cask "folium" do
  arch arm: "arm64", intel: "x64"

  version "0.1.1"
  sha256 arm:   "0c6c55a45837458343da60f358fda61dc73d3a4387fde1276d616f2886f0ff23",
         intel: "1b212446704793b2ccf6bf7758ffd53233ba59506eecb7967659e8b45bb906c9"

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
