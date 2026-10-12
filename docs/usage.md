---
layout: default
title: Usage
---
# Usage

## The Mac app

Open a folder with **File → Open Folder…** (⌘O) or by dropping it on the Dock icon. Folium reopens the last folder next time.

## The command line

```bash
folium                       # opens a folder picker in the browser
folium ~/Documents           # opens a folder directly
folium ~/Documents --port 8080
folium --help
```

Then open [http://localhost:3000](http://localhost:3000).

By default Folium only accepts connections from your own computer. To let other devices on your network open it, use `--host 0.0.0.0` — anyone who can reach that port can then read the folder you've opened.

## Keep it running in the background

With a Homebrew install, on macOS or Linux:

```bash
brew services start folium   # starts now and at login, on port 3000
brew services stop folium
```
