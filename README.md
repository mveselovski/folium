<h1 align="center">Folium</h1>

<p align="center">
  <a href="https://github.com/mveselovski/folium/actions/workflows/docker-build-push.yml">
    <img src="https://github.com/mveselovski/folium/actions/workflows/docker-build-push.yml/badge.svg" alt="Build and Push Docker Image">
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
- **Docker support** — run without installing Node locally

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

# Or via npx (no install needed)
npx folium ./my-docs
```

Then open [http://localhost:3000](http://localhost:3000).

### With Docker

```bash
# Make the script executable (one time)
chmod +x folium.sh

# Open with directory picker (mounts your home dir)
./folium.sh

# Open a specific folder directly
./folium.sh ~/Documents

# Custom port
./folium.sh ~/Documents --port 8080
```

The Docker container mounts your filesystem **read-only** — Folium never writes to your files.

To rebuild the image after updating `folium.js`:

```bash
docker rmi folium
./folium.sh
```

### With Docker Compose

```bash
docker compose up
```

This pulls the pre-built image from `ghcr.io/mveselovski/folium:latest`, mounts your home directory read-only, and serves Folium on [http://localhost:3000](http://localhost:3000).

To run in the background:

```bash
docker compose up -d
```

To stop:

```bash
docker compose down
```

## Project structure

```
folium/
├── folium.js      # the entire app — server + embedded UI
├── folium.sh      # Docker convenience wrapper
├── Dockerfile
├── package.json
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
