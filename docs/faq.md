---
layout: default
title: FAQ
---
# FAQ

## Does Folium change or upload my files?

No. Folium only reads files; it never creates, changes or deletes anything. Documents are converted on your machine and nothing about your files is sent anywhere. The interface loads its fonts from Google Fonts; without internet it falls back to system fonts.

## Can other people on my network see my files?

Not by default — Folium only accepts connections from your own computer. If you start it with `--host 0.0.0.0`, anyone who can reach that port can read the folder you've opened.

## Why do `.doc` files look plain on Linux?

Old Word `.doc` files are shown formatted on macOS and as plain text on Linux.

## Can I open DRM-protected e-books?

No. DRM-protected books can't be opened.

## Which Linux distributions are supported?

x64 and arm64 distributions with glibc 2.28 or newer — Ubuntu 20.04+, Debian 10+, Fedora, RHEL 8+ and similar. Alpine isn't supported.

## Is there a Windows version?

Not yet.

## How does it work?

Folium is a single-file [Express](https://expressjs.com) server with its web interface embedded. When you pick a document it converts it to HTML on your machine — Word with [mammoth](https://github.com/mwilliamson/mammoth.js), spreadsheets and CSV with [SheetJS](https://sheetjs.com), Markdown with [marked](https://marked.js.org) — and the page shows the result.

- **Folium.app** is a small native Swift window around the same server, with Node.js bundled inside.
- **The Linux binary** is the same server bundled into a Node.js [single executable](https://nodejs.org/api/single-executable-applications.html).
- **Homebrew** installs the command line from source and the app from its dmg, via [mveselovski/homebrew-tap](https://github.com/mveselovski/homebrew-tap).

## Something's wrong or missing

Open an issue on [GitHub]({{ site.repo }}/issues).
