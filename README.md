<h1 align="center">Folium</h1>

<p align="center">
  <a href="https://github.com/mveselovski/folium/actions/workflows/release.yml">
    <img src="https://github.com/mveselovski/folium/actions/workflows/release.yml/badge.svg" alt="Release">
  </a>
</p>

> ⚠️ **Platform support:** macOS and Linux only. Windows is not currently supported.

A lightweight local document browser. Point it at a folder and browse your files — markdown, Word, Excel, CSV, HTML, and plain text — in the browser with a clean light/dark UI.

## Features

- **Multi-format viewer** — `.md`, `.docx`, `.xlsx`, `.csv`, `.html`, `.htm`, `.txt`
- **In-browser directory picker** — navigate your filesystem and choose a folder without touching the CLI
- **Light & dark themes** — toggle in the sidebar, preference saved across sessions
- **Sort by name, type, or date** — with ascending/descending toggle, persisted to localStorage
- **Excel sheet tabs** — multi-sheet `.xlsx` files show a tab switcher
- **HTML sandboxed preview** — renders HTML files in an isolated iframe with an "open in new tab" link
- **Single file** — everything in one `folium.js`, no build step
- **Homebrew install** — `brew install` and run, or keep it running with `brew services`

## Supported formats

| Format | Extension | Renderer |
|--------|-----------|----------|
| Markdown | `.md` | marked |
| Word | `.docx` | mammoth |
| Excel | `.xlsx` | xlsx |
| CSV | `.csv` | xlsx |
| HTML | `.html`, `.htm` | sandboxed iframe |
| Plain text | `.txt` | pre block |

## Quick start

### macOS app

Download the `.dmg` for your Mac (Apple Silicon: `arm64`, Intel: `x64`) from the [latest release](https://github.com/mveselovski/folium/releases/latest) and drag **Folium** to Applications — or install it with Homebrew:

```bash
brew tap mveselovski/folium https://github.com/mveselovski/folium
brew install --cask folium
```

Folium.app is self-contained (Node.js is bundled) and signed and notarized by Apple. Open a folder with **File → Open Folder…** (⌘O) or drop one on the Dock icon; it reopens the last folder on launch. Its server listens on `127.0.0.1` only.

### Command line, with Homebrew

```bash
# Install (one time)
brew tap mveselovski/folium https://github.com/mveselovski/folium
brew install folium            # the CLI formula (the app is --cask folium)

# Open with directory picker
folium

# Open a specific folder
folium ~/Documents

# Custom port
folium ~/Documents --port 8080

# Only listen on this machine
folium ~/Documents --host 127.0.0.1
```

Then open [http://localhost:3000](http://localhost:3000).

To keep Folium running in the background (and start it at login):

```bash
brew services start folium
brew services stop folium   # to stop
```

The service listens on port 3000 and opens with the directory picker. Logs go to `$(brew --prefix)/var/log/folium.log`.

To upgrade:

```bash
brew update && brew upgrade folium
```

Folium only ever reads your files — it never writes to them.

### With Node.js

```bash
# Install dependencies (one time)
npm install

# Open with directory picker
node folium.js

# Open a specific folder
node folium.js ~/Documents

# Custom port
node folium.js ~/Documents --port 8080
```

## Releasing

1. Bump `version` in `package.json` and merge to `main`.
2. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`

   The [release workflow](.github/workflows/release.yml) creates the GitHub release and updates `url`/`sha256` in [`Formula/folium.rb`](Formula/folium.rb) on `main`.
3. Pull `main`, then build, sign and notarize the app on your Mac:

   ```bash
   macos/build.sh
   ```

   This writes `dist/Folium-<version>-{arm64,x64}.dmg` and updates [`Casks/folium.rb`](Casks/folium.rb). Upload the dmgs to the release and commit the cask:

   ```bash
   gh release upload v0.2.0 dist/Folium-0.2.0-*.dmg
   git commit -am "Folium.app 0.2.0" && git push
   ```

One-time signing setup for `macos/build.sh`:

- Xcode → Settings → Accounts → Manage Certificates → **+** → *Developer ID Application*
- `xcrun notarytool store-credentials folium-notary --apple-id <apple-id> --team-id <team-id>` (with an app-specific password from [appleid.apple.com](https://appleid.apple.com))

`SKIP_NOTARIZE=1 macos/build.sh` builds a signed app without notarizing, for local testing.

## Project structure

```
folium/
├── .github/
│   └── workflows/
│       └── release.yml  # CI: GitHub release + Homebrew formula bump on tag
├── Casks/
│   └── folium.rb      # Homebrew cask for Folium.app
├── Formula/
│   └── folium.rb      # Homebrew formula (CLI)
├── macos/             # native macOS app: Swift/WebKit wrapper + build script
│   ├── Sources/Folium/
│   ├── Icon/make-icon.swift
│   └── build.sh       # build, sign, notarize, package dmg
├── folium.js          # the entire app — server + embedded UI
├── package.json
├── LICENSE
└── README.md
```

## How it works

Folium is a single-file Express server that:

1. Scans the selected directory recursively and builds a file tree
2. Serves a self-contained HTML UI (embedded in the JS file, no separate assets)
3. Converts documents on request — markdown via `marked`, Word via `mammoth`, spreadsheets via `xlsx`
4. Serves HTML files through a `/api/raw` endpoint loaded in a sandboxed iframe

All rendering happens server-side (except HTML files). No data leaves your machine.

## License

MIT
