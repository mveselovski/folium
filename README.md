<h1 align="center">Folium</h1>

<p align="center">
  <strong>Read every document in a folder, in one window.</strong>
</p>

<p align="center">
  <a href="https://github.com/mveselovski/folium/releases/latest"><img src="https://img.shields.io/github/v/release/mveselovski/folium" alt="Latest release"></a>
  <a href="https://github.com/mveselovski/folium/actions/workflows/release.yml"><img src="https://github.com/mveselovski/folium/actions/workflows/release.yml/badge.svg" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey" alt="macOS | Linux">
</p>

Most folders are a mix: Word documents, Excel sheets, CSV exports from the bank, Markdown notes, the odd HTML page. Reading them usually means opening Word for one, Excel or Numbers for the next, a text editor for the third — and waiting for each to start.

Folium is a fast, read-only viewer for exactly that. Point it at a folder and you get a file tree on the left and the selected document rendered on the right: Word as formatted text, spreadsheets as tables (with a tab per sheet), Markdown as a page, CSVs in whatever encoding they were saved in. Click through a whole folder in seconds without changing anything.

It runs entirely on your computer. Folium never modifies your files and never uploads them anywhere — it's a small local server that only you can reach, shown either in its own Mac app window or in your browser.

**Good for:** reviewing a folder of reports or invoices, skimming bank and accounting exports, reading project docs and notes, checking what's in a folder someone sent you.

## Features

- **One viewer for many formats** — Word, Excel, CSV, Markdown, HTML and plain text
- **Text in any language** — detects UTF-8, UTF-16 and legacy encodings such as Windows-1251 (Cyrillic) and Windows-1252
- **Spreadsheet tabs** — multi-sheet `.xlsx` files get a tab per sheet
- **Safe HTML preview** — HTML files open in a sandboxed frame
- **Folder tree with sorting** — by name, type or date, ascending or descending
- **Light and dark themes** — remembered between sessions
- **Read-only and local** — nothing is written, nothing leaves your machine

| Format | Extensions |
|---|---|
| Word | `.docx` |
| Excel | `.xlsx` |
| CSV | `.csv` |
| Markdown | `.md` |
| HTML | `.html`, `.htm` |
| Plain text | `.txt` |

## Install

### macOS — app

Download the `.dmg` for your Mac from the [latest release](https://github.com/mveselovski/folium/releases/latest) (`arm64` for Apple silicon, `x64` for Intel) and drag **Folium** to Applications. Or with Homebrew:

```bash
brew tap mveselovski/folium https://github.com/mveselovski/folium
brew trust mveselovski/folium
brew install --cask folium
```

The app is signed and notarized by Apple and needs nothing else installed. Open a folder with **File → Open Folder…** (⌘O) or by dropping it on the Dock icon; Folium reopens the last folder next time.

### macOS — command line

```bash
brew tap mveselovski/folium https://github.com/mveselovski/folium
brew trust mveselovski/folium
brew install folium
```

`brew trust` is needed because Folium comes from its own tap rather than Homebrew's core repository; Homebrew 7 won't install from a tap until you've trusted it.

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/mveselovski/folium/main/install.sh | sh
```

This installs a single self-contained `folium` binary (Node.js built in) to `~/.local/bin`, after verifying its checksum. It runs on x64 and arm64 distributions with glibc 2.28 or newer — Ubuntu 20.04+, Debian 10+, Fedora, RHEL 8+ and similar; Alpine isn't supported. You can also download `folium-<version>-linux-<arch>.tar.gz` from the [releases page](https://github.com/mveselovski/folium/releases/latest) and put `folium` anywhere on your `PATH`.

To update, run the installer again. To uninstall, delete `~/.local/bin/folium`.

Homebrew on Linux works too, with the same `brew tap`, `brew trust` and `brew install folium` as on macOS.

### Windows

Not supported yet.

## Usage

```bash
folium                       # opens a folder picker in the browser
folium ~/Documents           # opens a folder directly
folium ~/Documents --port 8080
folium --help
```

Then open [http://localhost:3000](http://localhost:3000).

By default Folium only accepts connections from your own computer. To let other devices on your network open it, use `--host 0.0.0.0` — anyone who can reach that port can then read the folder you've opened.

**Keep it running in the background** (Homebrew installs, macOS or Linux):

```bash
brew services start folium   # starts now and at login, on port 3000
brew services stop folium
```

## Privacy

- Folium only reads files; it never creates, changes or deletes anything.
- Documents are converted on your machine. Nothing about your files is sent anywhere.
- The interface loads its fonts from Google Fonts; without internet it falls back to system fonts.

## Run from source

Requires Node.js 18 or newer.

```bash
git clone https://github.com/mveselovski/folium.git
cd folium
npm install
node folium.js ~/Documents
```

## How it works

Folium is a single-file [Express](https://expressjs.com) server, [`folium.js`](folium.js), with its web interface embedded. When you pick a document it converts it to HTML on your machine — Word with [mammoth](https://github.com/mwilliamson/mammoth.js), spreadsheets and CSV with [SheetJS](https://sheetjs.com), Markdown with [marked](https://marked.js.org) — and the page shows the result.

- **Folium.app** ([`macos/`](macos)) is a small native Swift window around the same server, with Node.js bundled inside.
- **The Linux binary** is `folium.js` and its dependencies bundled into a Node.js [single executable](https://nodejs.org/api/single-executable-applications.html) ([`scripts/build-standalone.sh`](scripts/build-standalone.sh)).
- **Homebrew** installs it from source with the [formula](Formula/folium.rb) and the app with the [cask](Casks/folium.rb).

Maintainers: see [RELEASING.md](RELEASING.md).

## License

[MIT](LICENSE)
