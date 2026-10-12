---
layout: default
title: Install
---
# Install

## macOS — app

Download the `.dmg` for your Mac from the [latest release]({{ site.repo }}/releases/latest) (`arm64` for Apple silicon, `x64` for Intel) and drag **Folium** to Applications. Or with Homebrew:

```bash
brew install --cask mveselovski/tap/folium
```

The app is signed and notarized by Apple and needs nothing else installed. Open a folder with **File → Open Folder…** (⌘O) or by dropping it on the Dock icon; Folium reopens the last folder next time.

## macOS — command line

```bash
brew install mveselovski/tap/folium
```

Both come from the [mveselovski/homebrew-tap](https://github.com/mveselovski/homebrew-tap) tap. Using the full `mveselovski/tap/…` name adds the tap and trusts the package in one step — Homebrew 7 otherwise refuses to install from taps outside its own repositories. Upgrade with `brew upgrade` as usual.

## Linux

```bash
curl -fsSL https://raw.githubusercontent.com/mveselovski/folium/main/install.sh | sh
```

This installs a single self-contained `folium` binary (Node.js built in) to `~/.local/bin`, after verifying its checksum. It runs on x64 and arm64 distributions with glibc 2.28 or newer — Ubuntu 20.04+, Debian 10+, Fedora, RHEL 8+ and similar; Alpine isn't supported. You can also download `folium-<version>-linux-<arch>.tar.gz` from the [releases page]({{ site.repo }}/releases/latest) and put `folium` anywhere on your `PATH`.

To update, run the installer again. To uninstall, delete `~/.local/bin/folium`.

Homebrew on Linux works too: `brew install mveselovski/tap/folium`.

## Windows

Not supported yet.

## Run from source

Requires Node.js 18 or newer.

```bash
git clone https://github.com/mveselovski/folium.git
cd folium
npm install
node folium.js ~/Documents
```

Next: [Usage]({{ '/usage/' | relative_url }})
