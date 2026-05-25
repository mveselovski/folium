#!/usr/bin/env node
/**
 * folium — local document browser
 * Usage: node folium.js [directory] [--port 3000]
 *        node folium.js               ← opens with a directory picker
 *
 * Install deps once:  npm install express marked mammoth xlsx
 */

const express = require("express");
const path    = require("path");
const fs      = require("fs");
const os      = require("os");

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let docsDir = null;
let port = 3000;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) { port = parseInt(args[++i]); }
  else if (!args[i].startsWith("--")) { docsDir = path.resolve(args[i]); }
}
if (docsDir && !fs.existsSync(docsDir)) {
  console.error(`Directory not found: ${docsDir}`); process.exit(1);
}

// ─── Lazy require ─────────────────────────────────────────────────────────────
function req(mod) {
  try { return require(mod); }
  catch {
    console.error(`\nMissing dependency: ${mod}\nRun:  npm install express marked mammoth xlsx\n`);
    process.exit(1);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ─── File tree ────────────────────────────────────────────────────────────────
const SUPPORTED = new Set([".md",".docx",".xlsx",".csv",".txt",".html",".htm"]);

function buildTree(dir, base) {
  base = base || "";
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return []; }
  const nodes = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const rel  = base ? base + "/" + e.name : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const children = buildTree(full, rel);
      if (children.length) nodes.push({ type:"dir", name:e.name, path:rel, children });
    } else if (SUPPORTED.has(path.extname(e.name).toLowerCase())) {
      nodes.push({ type:"file", name:e.name, path:rel, ext:path.extname(e.name).slice(1).toLowerCase(), mtime: fs.statSync(full).mtimeMs });
    }
  }
  return nodes.sort((a,b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ─── Filesystem browser ───────────────────────────────────────────────────────
function browsePath(p) {
  p = path.resolve(p || os.homedir());
  let entries;
  try { entries = fs.readdirSync(p, { withFileTypes: true }); }
  catch { throw new Error("Cannot read directory: " + p); }
  const dirs = [], files = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    try {
      if (e.isDirectory()) dirs.push(e.name);
      else if (SUPPORTED.has(path.extname(e.name).toLowerCase())) files.push(e.name);
    } catch { /* skip inaccessible */ }
  }
  dirs.sort((a,b) => a.localeCompare(b));
  const parent = path.dirname(p) !== p ? path.dirname(p) : null;
  return { current: p, parent, dirs, fileCount: files.length };
}

// ─── File renderer ────────────────────────────────────────────────────────────
async function renderFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const abs = path.resolve(docsDir, filePath);
  if (!abs.startsWith(path.resolve(docsDir))) throw new Error("Access denied");
  if (!fs.existsSync(abs)) throw new Error("File not found");

  if (ext === ".md") {
    const { marked } = req("marked");
    return { html: marked.parse(fs.readFileSync(abs,"utf8")), type:"html" };
  }
  if (ext === ".txt") {
    return { html: "<pre class=\"txt\">" + escHtml(fs.readFileSync(abs,"utf8")) + "</pre>", type:"html" };
  }
  if (ext === ".csv") {
    const XLSX = req("xlsx");
    const wb = XLSX.readFile(abs);
    return { html: XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]), type:"table" };
  }
  if (ext === ".xlsx") {
    const XLSX = req("xlsx");
    const wb = XLSX.readFile(abs);
    const nav  = wb.SheetNames.map((n,i) =>
      "<button class=\"tab-btn" + (i===0?" active":"") + "\" data-idx=\"" + i + "\">" + escHtml(n) + "</button>"
    ).join("");
    const tabs = wb.SheetNames.map(n =>
      "<div class=\"sheet-tab\">" + XLSX.utils.sheet_to_html(wb.Sheets[n]) + "</div>"
    ).join("");
    return { html: "<div class=\"tab-nav\">" + nav + "</div><div class=\"sheets\">" + tabs + "</div>", type:"table" };
  }
  if (ext === ".html" || ext === ".htm") {
    return { type: "iframe", src: "/api/raw?path=" + encodeURIComponent(filePath) };
  }
  if (ext === ".docx") {
    const mammoth = req("mammoth");
    const result = await mammoth.convertToHtml({ path: abs });
    return { html: result.value, type:"html" };
  }
  throw new Error("Unsupported format");
}

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get("/api/meta",   (_q, res) => res.json({ dir: docsDir }));
app.get("/api/files",  (_q, res) => {
  if (!docsDir) return res.json([]);
  try { res.json(buildTree(docsDir)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/browse", (req2, res) => {
  try { res.json(browsePath(req2.query.path || "")); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/setdir", (req2, res) => {
  const p = req2.body && req2.body.path;
  if (!p) return res.status(400).json({ error: "No path provided" });
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) return res.status(400).json({ error: "Directory not found" });
  docsDir = abs;
  console.log("  Directory changed to: " + docsDir);
  res.json({ ok: true, dir: docsDir });
});
app.get("/api/raw", (req2, res) => {
  if (!docsDir) return res.status(400).send("No directory selected");
  try {
    const file = req2.query.path;
    if (!file) return res.status(400).send("No path");
    const abs = path.resolve(docsDir, file);
    if (!abs.startsWith(path.resolve(docsDir))) return res.status(403).send("Access denied");
    if (!fs.existsSync(abs)) return res.status(404).send("Not found");
    const ext = path.extname(abs).toLowerCase();
    if (ext !== ".html" && ext !== ".htm") return res.status(400).send("Not an HTML file");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fs.readFileSync(abs));
  } catch (e) { res.status(500).send(e.message); }
});

app.get("/api/render", async (req2, res) => {
  try {
    const file = req2.query.path;
    if (!file) return res.status(400).json({ error: "No path" });
    res.json(await renderFile(file));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── HTML ─────────────────────────────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>folium</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
/* ── Reset ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ════════════════════════════════════════
   DARK THEME  (default)
   ════════════════════════════════════════ */
:root,[data-theme="dark"]{
  --bg:          #0e0f11;
  --surface:     #161719;
  --surface2:    #1c1e21;
  --surface3:    #212326;
  --border:      #252729;
  --border2:     #2e3033;
  --muted:       #3a3c40;
  --text:        #d4d6da;
  --text-dim:    #6b6e75;
  --text-faint:  #44474d;
  --accent:      #4af0a0;
  --accent-bg:   rgba(74,240,160,.08);
  --accent-bdr:  rgba(74,240,160,.3);
  --accent2:     #6b8cff;
  --warn:        #f0a04a;
  --error:       #ff6b6b;
  --error-bg:    rgba(255,80,80,.08);
  --error-bdr:   rgba(255,80,80,.2);
  --shadow:      0 24px 64px rgba(0,0,0,.6);
  --tree-hover:  rgba(255,255,255,.04);
  --tree-active: rgba(74,240,160,.07);
  --row-hover:   rgba(255,255,255,.025);
  --code-bg:     #0a0b0d;
  --toggle-bg:   #252729;
  --toggle-knob: #6b6e75;
}

/* ════════════════════════════════════════
   LIGHT THEME
   ════════════════════════════════════════ */
[data-theme="light"]{
  --bg:          #f5f5f0;
  --surface:     #ffffff;
  --surface2:    #f8f8f5;
  --surface3:    #f0f0eb;
  --border:      #e2e2dc;
  --border2:     #d8d8d2;
  --muted:       #c8c8c2;
  --text:        #1a1a1a;
  --text-dim:    #6e6e6a;
  --text-faint:  #b0b0aa;
  --accent:      #0d7a4e;
  --accent-bg:   rgba(13,122,78,.07);
  --accent-bdr:  rgba(13,122,78,.3);
  --accent2:     #3d5fcc;
  --warn:        #b35c00;
  --error:       #c0392b;
  --error-bg:    rgba(192,57,43,.07);
  --error-bdr:   rgba(192,57,43,.2);
  --shadow:      0 16px 48px rgba(0,0,0,.14);
  --tree-hover:  rgba(0,0,0,.04);
  --tree-active: rgba(13,122,78,.07);
  --row-hover:   rgba(0,0,0,.02);
  --code-bg:     #f0f0eb;
  --toggle-bg:   #e2e2dc;
  --toggle-knob: #ffffff;
}

/* ── Base ── */
html,body{height:100%;background:var(--bg);color:var(--text);font-family:'IBM Plex Sans',sans-serif;font-size:14px;transition:background .2s,color .2s}
.layout{display:flex;height:100vh;overflow:hidden}

/* ── Sidebar ── */
.sidebar{
  width:260px;flex-shrink:0;
  background:var(--surface);border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden;
  transition:background .2s,border-color .2s;
}
.sidebar-header{
  padding:14px 12px 12px;border-bottom:1px solid var(--border);
  display:flex;flex-direction:column;gap:8px;
}
.sidebar-top{display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:500;color:var(--accent);letter-spacing:-.5px}

/* theme toggle */
.theme-toggle{
  position:relative;width:36px;height:20px;
  background:var(--toggle-bg);border:1px solid var(--border2);
  border-radius:10px;cursor:pointer;flex-shrink:0;
  transition:background .2s,border-color .2s;outline:none;
}
.theme-toggle:hover{border-color:var(--muted)}
.theme-toggle::after{
  content:'';position:absolute;top:2px;left:2px;
  width:14px;height:14px;border-radius:50%;
  background:var(--toggle-knob);
  transition:transform .2s,background .2s;
  box-shadow:0 1px 3px rgba(0,0,0,.3);
}
[data-theme="light"] .theme-toggle::after{transform:translateX(16px);background:var(--accent)}
.toggle-icons{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 4px;pointer-events:none;font-size:9px;line-height:1}
.toggle-icons .ic-moon{opacity:1}
.toggle-icons .ic-sun{opacity:1}
[data-theme="light"] .toggle-icons .ic-moon{opacity:.4}
[data-theme="dark"]  .toggle-icons .ic-sun{opacity:.4}

.dir-label{font-size:10px;color:var(--text-dim);font-family:'IBM Plex Mono',monospace;word-break:break-all;line-height:1.5;min-height:14px}
.btn-change{
  font-size:11px;font-family:'IBM Plex Mono',monospace;
  background:transparent;border:1px solid var(--border);color:var(--text-dim);
  padding:5px 8px;border-radius:4px;cursor:pointer;
  transition:border-color .15s,color .15s;width:100%;text-align:left;
}
.btn-change:hover{border-color:var(--accent);color:var(--accent)}

/* ── Tree ── */
.tree{flex:1;overflow-y:auto;padding:8px 0}
.tree::-webkit-scrollbar{width:4px}
.tree::-webkit-scrollbar-thumb{background:var(--muted);border-radius:2px}
.tree-node{user-select:none}
.tree-row{
  display:flex;align-items:center;gap:6px;padding:5px 12px;
  cursor:pointer;border-left:2px solid transparent;
  transition:background .1s,border-color .1s;
}
.tree-row:hover{background:var(--tree-hover)}
.tree-row.active{background:var(--tree-active);border-left-color:var(--accent)}
.tree-row .icon{font-size:13px;flex-shrink:0}
.tree-row .name{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tree-row .ext-badge{
  margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:10px;
  padding:1px 5px;border-radius:3px;flex-shrink:0;
  background:var(--muted);color:var(--text-dim);
}
.ext-md  {background:var(--accent-bg);color:var(--accent)}
.ext-docx{background:rgba(107,140,255,.12);color:var(--accent2)}
.ext-xlsx{background:rgba(74,210,90,.1);color:#2a9e3a}
[data-theme="light"] .ext-xlsx{color:#1d7a2e}
.ext-csv {background:rgba(240,160,74,.1);color:var(--warn)}
.ext-html{background:rgba(255,140,60,.12);color:#e0721a}
[data-theme="light"] .ext-html{color:#c05a10}
.ext-htm{background:rgba(255,140,60,.12);color:#e0721a}
[data-theme="light"] .ext-htm{color:#c05a10}

/* html file iframe */
.iframe-toolbar{
  display:flex;align-items:center;gap:8px;
  padding:8px 12px;background:var(--surface2);
  border:1px solid var(--border);border-radius:6px 6px 0 0;
  font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim);
}
.iframe-toolbar a{color:var(--accent2);text-decoration:none;margin-left:auto;font-size:11px}
.iframe-toolbar a:hover{text-decoration:underline}
.iframe-wrap{
  border:1px solid var(--border);border-top:none;
  border-radius:0 0 6px 6px;overflow:hidden;
  height:calc(100vh - 200px);min-height:400px;
}
.iframe-wrap iframe{width:100%;height:100%;border:none;display:block;background:#fff}

.dir-row .name{font-weight:500}

/* sort bar */
.sort-bar{display:flex;align-items:center;gap:2px;padding:6px 10px 2px;border-bottom:1px solid var(--border)}
.sort-label{font-size:10px;color:var(--text-faint);font-family:'IBM Plex Mono',monospace;margin-right:4px;text-transform:uppercase;letter-spacing:.05em}
.sort-btn{
  font-size:10px;font-family:'IBM Plex Mono',monospace;
  background:transparent;border:1px solid transparent;
  color:var(--text-dim);padding:2px 7px;border-radius:3px;
  cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:3px;
}
.sort-btn:hover{color:var(--text);background:var(--tree-hover)}
.sort-btn.active{color:var(--accent);border-color:var(--accent-bdr);background:var(--accent-bg)}
.sort-arrow{font-size:9px;opacity:.7}

.dir-children{padding-left:12px}
.dir-children.collapsed{display:none}
.chevron{font-size:10px;color:var(--text-dim);transition:transform .15s;flex-shrink:0}
.dir-row.open .chevron{transform:rotate(90deg)}

/* ── Main ── */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{
  padding:0 24px;height:48px;flex-shrink:0;
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;
  background:var(--surface);transition:background .2s;
}
.breadcrumb{
  font-family:'IBM Plex Mono',monospace;font-size:12px;
  color:var(--text-dim);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.breadcrumb span{color:var(--text)}
.viewer{flex:1;overflow-y:auto;padding:40px 48px}
.viewer::-webkit-scrollbar{width:6px}
.viewer::-webkit-scrollbar-thumb{background:var(--muted);border-radius:3px}

/* ── States ── */
.empty-state{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text-dim)}
.empty-state .big{font-size:40px}
.empty-state p{font-size:13px}
.loading{padding:60px;text-align:center;color:var(--text-dim);font-family:'IBM Plex Mono',monospace;font-size:13px}
.error-msg{padding:20px 24px;background:var(--error-bg);border:1px solid var(--error-bdr);border-radius:6px;color:var(--error);font-family:'IBM Plex Mono',monospace;font-size:13px}

/* ════════════════════════════════════════
   PICKER OVERLAY
   ════════════════════════════════════════ */
.picker-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.55);
  display:flex;align-items:center;justify-content:center;
  z-index:100;backdrop-filter:blur(6px);
  opacity:0;pointer-events:none;transition:opacity .2s;
}
[data-theme="light"] .picker-overlay{background:rgba(0,0,0,.25)}
.picker-overlay.open{opacity:1;pointer-events:all}
.picker-modal{
  background:var(--surface);border:1px solid var(--border);
  border-radius:10px;width:620px;max-width:95vw;max-height:80vh;
  display:flex;flex-direction:column;overflow:hidden;
  box-shadow:var(--shadow);
  transform:translateY(10px);transition:transform .2s;
}
.picker-overlay.open .picker-modal{transform:translateY(0)}
.picker-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:8px;flex-shrink:0}
.picker-title{font-size:13px;font-weight:500;color:var(--text)}
.picker-path-bar{display:flex;align-items:center;gap:6px}
.picker-path{
  flex:1;font-family:'IBM Plex Mono',monospace;font-size:11px;
  color:var(--text-dim);background:var(--bg);
  border:1px solid var(--border);border-radius:4px;
  padding:6px 10px;outline:none;transition:border-color .15s,color .15s;
}
.picker-path:focus{border-color:var(--accent);color:var(--text)}
.picker-go{
  font-family:'IBM Plex Mono',monospace;font-size:11px;
  background:transparent;border:1px solid var(--border);
  color:var(--text-dim);padding:6px 12px;border-radius:4px;
  cursor:pointer;transition:all .15s;white-space:nowrap;
}
.picker-go:hover{border-color:var(--accent2);color:var(--accent2)}
.picker-list{flex:1;overflow-y:auto;padding:8px 0}
.picker-list::-webkit-scrollbar{width:4px}
.picker-list::-webkit-scrollbar-thumb{background:var(--muted);border-radius:2px}
.picker-item{
  display:flex;align-items:center;gap:10px;
  padding:8px 20px;cursor:pointer;
  transition:background .1s;border-left:2px solid transparent;
}
.picker-item:hover{background:var(--tree-hover)}
.picker-item .pi-icon{font-size:15px;flex-shrink:0}
.picker-item .pi-name{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.picker-item .pi-hint{margin-left:auto;font-size:11px;color:var(--text-faint);font-family:'IBM Plex Mono',monospace;white-space:nowrap;padding-left:8px}
.picker-item-up .pi-name{color:var(--text-dim)}
.picker-use-row{padding:8px 20px 4px;border-top:1px solid var(--border);margin-top:4px}
.picker-use-btn{
  font-family:'IBM Plex Mono',monospace;font-size:11px;
  background:var(--accent-bg);border:1px solid var(--accent-bdr);
  color:var(--accent);padding:6px 14px;border-radius:4px;
  cursor:pointer;width:100%;text-align:center;transition:background .15s;
}
.picker-use-btn:hover{filter:brightness(1.1)}
.picker-footer{
  padding:12px 20px;border-top:1px solid var(--border);
  display:flex;align-items:center;gap:8px;flex-shrink:0;
  background:var(--surface2);
}
.picker-sel-label{flex:1;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.picker-sel-label.has-path{color:var(--accent)}
.btn-open{
  font-family:'IBM Plex Mono',monospace;font-size:12px;
  padding:7px 18px;background:var(--accent);color:#fff;
  border:none;border-radius:5px;cursor:pointer;font-weight:500;
  transition:opacity .15s;
}
[data-theme="dark"] .btn-open{color:#000}
.btn-open:disabled{opacity:.3;cursor:default}
.btn-open:not(:disabled):hover{opacity:.85}
.btn-cancel{
  font-family:'IBM Plex Mono',monospace;font-size:12px;
  padding:7px 12px;background:transparent;
  border:1px solid var(--border);color:var(--text-dim);
  border-radius:5px;cursor:pointer;transition:all .15s;
}
.btn-cancel:hover{border-color:var(--muted);color:var(--text)}
.picker-msg{padding:6px 20px 0;color:var(--error);font-size:12px;font-family:'IBM Plex Mono',monospace}

/* ════════════════════════════════════════
   CONTENT — html/markdown/docx
   ════════════════════════════════════════ */
.content-html{max-width:800px;line-height:1.8;color:var(--text)}
.content-html h1,.content-html h2,.content-html h3,.content-html h4{
  color:var(--text);font-weight:600;margin:1.6em 0 .5em;line-height:1.3;
}
.content-html h1{
  font-size:1.9em;letter-spacing:-.4px;
  border-bottom:2px solid var(--border);padding-bottom:10px;
}
.content-html h2{font-size:1.35em;border-bottom:1px solid var(--border);padding-bottom:6px}
.content-html h3{font-size:1.1em;color:var(--accent)}
.content-html p{margin:.85em 0}
.content-html a{color:var(--accent2);text-decoration:none}
.content-html a:hover{text-decoration:underline}
.content-html code{
  font-family:'IBM Plex Mono',monospace;font-size:.83em;
  background:var(--surface3);padding:2px 6px;border-radius:3px;
  border:1px solid var(--border);color:var(--accent);
}
.content-html pre{
  background:var(--code-bg);border:1px solid var(--border);
  border-radius:6px;padding:16px;overflow-x:auto;margin:1.2em 0;
}
.content-html pre code{background:none;padding:0;border:none;color:var(--text)}
.content-html blockquote{
  border-left:3px solid var(--accent);padding-left:16px;
  margin:1.2em 0;color:var(--text-dim);font-style:italic;
}
.content-html ul,.content-html ol{padding-left:24px;margin:.85em 0}
.content-html li{margin:.35em 0}
.content-html hr{border:none;border-top:1px solid var(--border);margin:2em 0}
.content-html img{max-width:100%;border-radius:4px;border:1px solid var(--border)}
.content-html table{border-collapse:collapse;width:100%;margin:1em 0}
.content-html th,.content-html td{border:1px solid var(--border);padding:7px 12px;text-align:left;font-size:13px}
.content-html th{background:var(--surface3);font-weight:600}
.content-html tr:nth-child(even) td{background:var(--surface2)}
pre.txt{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--text);white-space:pre-wrap;line-height:1.7}

/* ── Tables (xlsx/csv) ── */
.tab-nav{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:8px}
.tab-btn{
  font-family:'IBM Plex Mono',monospace;font-size:12px;
  background:transparent;border:1px solid var(--border);
  color:var(--text-dim);padding:4px 12px;border-radius:4px;
  cursor:pointer;transition:all .15s;
}
.tab-btn:hover{border-color:var(--muted);color:var(--text)}
.tab-btn.active{border-color:var(--accent);color:var(--accent);background:var(--accent-bg)}
.sheet-tab{display:none}
.sheet-tab.visible{display:block}
.content-table{overflow-x:auto}
.content-table table{border-collapse:collapse;font-size:13px;font-family:'IBM Plex Mono',monospace;width:100%;min-width:400px}
.content-table td,.content-table th{border:1px solid var(--border);padding:6px 12px;text-align:left;white-space:nowrap}
.content-table th,.content-table tr:first-child td{background:var(--surface3);font-weight:600}
.content-table tr:hover td{background:var(--row-hover)}
</style>
</head>
<body>

<!-- picker -->
<div class="picker-overlay" id="pickerOverlay">
  <div class="picker-modal">
    <div class="picker-header">
      <div class="picker-title">&#128193; Choose a folder to browse</div>
      <div class="picker-path-bar">
        <input class="picker-path" id="pickerPathInput" type="text" placeholder="Type a path and press Enter" />
        <button class="picker-go" id="btnPickerGo">Go</button>
      </div>
    </div>
    <div class="picker-list" id="pickerList"></div>
    <div class="picker-msg" id="pickerMsg" style="display:none"></div>
    <div class="picker-footer">
      <div class="picker-sel-label" id="pickerSelLabel">No folder selected</div>
      <button class="btn-cancel" id="btnPickerCancel">Cancel</button>
      <button class="btn-open" id="btnPickerOpen" disabled>Open folder</button>
    </div>
  </div>
</div>

<!-- layout -->
<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-top">
        <span class="logo">folium</span>
        <button class="theme-toggle" id="themeToggle" title="Toggle theme" aria-label="Toggle light/dark theme">
          <span class="toggle-icons">
            <span class="ic-moon">&#9790;</span>
            <span class="ic-sun">&#9788;</span>
          </span>
        </button>
      </div>
      <div class="dir-label" id="dirLabel">No folder open</div>
      <button class="btn-change" id="btnChangeDir">&#128193; Change folder&hellip;</button>
    </div>
    <div class="sort-bar">
      <span class="sort-label">Sort</span>
      <button class="sort-btn active" id="sortName" title="Sort by name">Name<span class="sort-arrow" id="sortNameArrow">&#8593;</span></button>
      <button class="sort-btn" id="sortType" title="Sort by file type">Type<span class="sort-arrow" id="sortTypeArrow">&#8593;</span></button>
      <button class="sort-btn" id="sortDate" title="Sort by modified date">Date<span class="sort-arrow" id="sortDateArrow">&#8595;</span></button>
    </div>
    <div class="tree" id="tree"></div>
  </aside>
  <main class="main">
    <div class="topbar">
      <div class="breadcrumb" id="breadcrumb"><span>Select a file</span></div>
    </div>
    <div class="viewer" id="viewer">
      <div class="empty-state">
        <div class="big">&#128193;</div>
        <p>Open a folder to get started</p>
      </div>
    </div>
  </main>
</div>

<script>
var activeRow = null;
var pickerCurrentPath = '';
var pickerSelectedPath = '';

/* ═══════════════════════════════════════
   THEME
   ═══════════════════════════════════════ */
function getTheme() {
  try { return localStorage.getItem('folium-theme') || 'dark'; } catch(e) { return 'dark'; }
}
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('folium-theme', t); } catch(e) {}
}
function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/* apply saved theme immediately before first paint */
setTheme(getTheme());

document.getElementById('themeToggle').addEventListener('click', toggleTheme);

/* ═══════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════ */
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function joinPath(base, name) {
  var sep = (base.indexOf('/') !== -1) ? '/' : '\\\\';
  return base.slice(-1) === sep ? base + name : base + sep + name;
}

/* ═══════════════════════════════════════
   PICKER
   ═══════════════════════════════════════ */
function openPicker(canCancel) {
  document.getElementById('pickerMsg').style.display = 'none';
  document.getElementById('btnPickerCancel').style.display = canCancel ? '' : 'none';
  document.getElementById('pickerOverlay').classList.add('open');
  browseDir(pickerCurrentPath || '');
}
function closePicker() {
  document.getElementById('pickerOverlay').classList.remove('open');
}
async function browseDir(p) {
  setPickerMsg('');
  var list = document.getElementById('pickerList');
  list.innerHTML = '<div style="padding:20px;color:var(--text-dim);font-family:IBM Plex Mono,monospace;font-size:12px">Loading&hellip;</div>';
  try {
    var res = await fetch('/api/browse?path=' + encodeURIComponent(p || ''));
    var data = await res.json();
    if (data.error) { setPickerMsg(data.error); list.innerHTML = ''; return; }
    pickerCurrentPath = data.current;
    document.getElementById('pickerPathInput').value = data.current;
    renderPickerList(data);
  } catch(e) { setPickerMsg(e.message); }
}
function setPickerMsg(msg) {
  var el = document.getElementById('pickerMsg');
  if (msg) { el.textContent = msg; el.style.display = 'block'; }
  else el.style.display = 'none';
}
function renderPickerList(data) {
  var list = document.getElementById('pickerList');
  list.innerHTML = '';

  if (data.parent !== null) {
    var up = document.createElement('div');
    up.className = 'picker-item picker-item-up';
    up.innerHTML = '<span class="pi-icon">&#8593;</span><span class="pi-name">..</span><span class="pi-hint">' + esc(data.parent) + '</span>';
    up.addEventListener('click', function() { browseDir(data.parent); });
    list.appendChild(up);
  }

  data.dirs.forEach(function(name) {
    var item = document.createElement('div');
    item.className = 'picker-item';
    item.innerHTML = '<span class="pi-icon">&#128193;</span><span class="pi-name">' + esc(name) + '</span><span class="pi-hint">&#8250;</span>';
    item.addEventListener('click', function() { browseDir(joinPath(data.current, name)); });
    list.appendChild(item);
  });

  if (data.dirs.length === 0) {
    var note = document.createElement('div');
    note.style.cssText = 'padding:16px 20px;color:var(--text-dim);font-size:12px;font-family:IBM Plex Mono,monospace';
    note.textContent = data.fileCount > 0 ? 'No sub-folders here.' : 'Empty directory.';
    list.appendChild(note);
  }

  var useRow = document.createElement('div');
  useRow.className = 'picker-use-row';
  var useBtn = document.createElement('button');
  useBtn.className = 'picker-use-btn';
  var docLabel = data.fileCount > 0
    ? ' (' + data.fileCount + ' doc' + (data.fileCount === 1 ? '' : 's') + ')'
    : ' (no docs here)';
  useBtn.innerHTML = '&#10003;&nbsp; Use current folder' + docLabel;
  useBtn.addEventListener('click', function() { markSelected(data.current); });
  useRow.appendChild(useBtn);
  list.appendChild(useRow);
}
function markSelected(p) {
  pickerSelectedPath = p;
  var label = document.getElementById('pickerSelLabel');
  label.textContent = p;
  label.classList.add('has-path');
  document.getElementById('btnPickerOpen').disabled = false;
}

document.getElementById('btnPickerOpen').addEventListener('click', async function() {
  if (!pickerSelectedPath) return;
  try {
    var res = await fetch('/api/setdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pickerSelectedPath })
    });
    var data = await res.json();
    if (data.error) { setPickerMsg(data.error); return; }
    closePicker();
    loadTree();
  } catch(e) { setPickerMsg(e.message); }
});
document.getElementById('btnPickerGo').addEventListener('click', function() {
  browseDir(document.getElementById('pickerPathInput').value.trim());
});
document.getElementById('pickerPathInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') browseDir(this.value.trim());
});
document.getElementById('btnPickerCancel').addEventListener('click', closePicker);
document.getElementById('pickerOverlay').addEventListener('click', function(e) {
  if (e.target !== this) return;
  if (document.getElementById('btnPickerCancel').style.display !== 'none') closePicker();
});
document.getElementById('btnChangeDir').addEventListener('click', function() {
  pickerSelectedPath = '';
  var label = document.getElementById('pickerSelLabel');
  label.textContent = 'No folder selected';
  label.classList.remove('has-path');
  document.getElementById('btnPickerOpen').disabled = true;
  openPicker(true);
});

/* ═══════════════════════════════════════
   SORT
   ═══════════════════════════════════════ */
var sortKey = 'name';   // 'name' | 'type' | 'date'
var sortDir = 1;        // 1 = asc, -1 = desc
var cachedTree = null;

var EXT_ORDER = { md:0, docx:1, xlsx:2, csv:3, html:4, htm:4, txt:5 };

function getSort() {
  try {
    var s = JSON.parse(localStorage.getItem('folium-sort') || '{}');
    return { key: s.key || 'name', dir: s.dir || 1 };
  } catch(e) { return { key: 'name', dir: 1 }; }
}
function saveSort() {
  try { localStorage.setItem('folium-sort', JSON.stringify({ key: sortKey, dir: sortDir })); } catch(e) {}
}

function applySort(nodes) {
  /* deep-clone so we don't mutate server data */
  return nodes.map(function(n) {
    return n.type === 'dir'
      ? Object.assign({}, n, { children: applySort(n.children) })
      : n;
  }).sort(function(a, b) {
    /* folders always first */
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    if (a.type === 'dir') return a.name.localeCompare(b.name);

    var r = 0;
    if (sortKey === 'name') {
      r = a.name.localeCompare(b.name);
    } else if (sortKey === 'type') {
      var ao = EXT_ORDER[a.ext] !== undefined ? EXT_ORDER[a.ext] : 99;
      var bo = EXT_ORDER[b.ext] !== undefined ? EXT_ORDER[b.ext] : 99;
      r = ao !== bo ? ao - bo : a.name.localeCompare(b.name);
    } else if (sortKey === 'date') {
      r = (a.mtime || 0) - (b.mtime || 0);
    }
    return r * sortDir;
  });
}

function updateSortButtons() {
  ['name','type','date'].forEach(function(k) {
    var btn   = document.getElementById('sort' + k.charAt(0).toUpperCase() + k.slice(1));
    var arrow = document.getElementById('sort' + k.charAt(0).toUpperCase() + k.slice(1) + 'Arrow');
    if (!btn) return;
    btn.classList.toggle('active', k === sortKey);
    arrow.innerHTML = sortDir === 1 ? '&#8593;' : '&#8595;';
    arrow.style.opacity = k === sortKey ? '1' : '0';
  });
}

['name','type','date'].forEach(function(k) {
  var id = 'sort' + k.charAt(0).toUpperCase() + k.slice(1);
  document.getElementById(id).addEventListener('click', function() {
    if (sortKey === k) {
      sortDir = sortDir * -1;
    } else {
      sortKey = k;
      sortDir = k === 'date' ? -1 : 1;  /* date defaults to newest-first */
    }
    saveSort();
    updateSortButtons();
    if (cachedTree) {
      var treeEl = document.getElementById('tree');
      treeEl.innerHTML = '';
      renderTree(applySort(cachedTree), treeEl);
    }
  });
});

/* restore saved sort prefs */
(function() {
  var s = getSort();
  sortKey = s.key; sortDir = s.dir;
  updateSortButtons();
})();

/* ═══════════════════════════════════════
   FILE TREE
   ═══════════════════════════════════════ */
async function loadTree() {
  var meta = await fetch('/api/meta').then(function(r) { return r.json(); });
  document.getElementById('dirLabel').textContent = meta.dir || 'No folder open';
  var treeEl = document.getElementById('tree');
  treeEl.innerHTML = '';
  activeRow = null;
  cachedTree = null;
  document.getElementById('viewer').innerHTML =
    '<div class="empty-state"><div class="big">&#128193;</div><p>Choose a file from the sidebar</p></div>';
  document.getElementById('breadcrumb').innerHTML = '<span>Select a file</span>';
  if (!meta.dir) return;
  var res = await fetch('/api/files');
  var tree = await res.json();
  if (!tree.length) {
    treeEl.innerHTML = '<div style="padding:20px 16px;color:var(--text-dim);font-size:12px;font-family:IBM Plex Mono,monospace">No supported files found.</div>';
    return;
  }
  cachedTree = tree;
  renderTree(applySort(tree), treeEl);
}

var EXT_ICONS = { md:'&#128221;', docx:'&#128196;', xlsx:'&#128202;', csv:'&#128203;', txt:'&#128221;', html:'&#127760;', htm:'&#127760;' };

function renderTree(nodes, container) {
  nodes.forEach(function(node) {
    var el = document.createElement('div');
    el.className = 'tree-node';
    if (node.type === 'dir') {
      el.innerHTML =
        '<div class="tree-row dir-row" data-path="' + node.path + '">' +
          '<span class="chevron">&#9658;</span>' +
          '<span class="icon">&#128193;</span>' +
          '<span class="name">' + esc(node.name) + '</span>' +
        '</div>' +
        '<div class="dir-children collapsed"></div>';
      var row = el.querySelector('.tree-row');
      var children = el.querySelector('.dir-children');
      renderTree(node.children, children);
      row.addEventListener('click', function() {
        row.classList.toggle('open');
        children.classList.toggle('collapsed');
      });
    } else {
      el.innerHTML =
        '<div class="tree-row" data-path="' + node.path + '">' +
          '<span class="icon">' + (EXT_ICONS[node.ext] || '&#128196;') + '</span>' +
          '<span class="name">' + esc(node.name) + '</span>' +
          '<span class="ext-badge ext-' + node.ext + '">' + node.ext + '</span>' +
        '</div>';
      el.querySelector('.tree-row').addEventListener('click', function(e) { openFile(node, e.currentTarget); });
    }
    container.appendChild(el);
  });
}

/* ═══════════════════════════════════════
   FILE VIEWER
   ═══════════════════════════════════════ */
async function openFile(node, rowEl) {
  if (activeRow) activeRow.classList.remove('active');
  rowEl.classList.add('active');
  activeRow = rowEl;
  var parts = node.path.split('/');
  document.getElementById('breadcrumb').innerHTML =
    parts.map(function(p, i) {
      return i === parts.length - 1 ? '<span>' + esc(p) + '</span>' : esc(p);
    }).join(' / ');
  var viewer = document.getElementById('viewer');
  viewer.innerHTML = '<div class="loading">Loading&hellip;</div>';
  try {
    var res = await fetch('/api/render?path=' + encodeURIComponent(node.path));
    var data = await res.json();
    if (data.error) { viewer.innerHTML = '<div class="error-msg">&#9888; ' + esc(data.error) + '</div>'; return; }
    if (data.type === 'iframe') {
      var toolbar = '<div class="iframe-toolbar">' +
        '&#127760;&nbsp;' + esc(node.name) +
        '<a href="' + data.src + '" target="_blank">open in new tab &#8599;</a>' +
        '</div>';
      var frame = '<div class="iframe-wrap">' +
        '<iframe src="' + data.src + '" sandbox="allow-scripts allow-same-origin" title="' + esc(node.name) + '"></iframe>' +
        '</div>';
      viewer.innerHTML = toolbar + frame;
    } else if (data.type === 'table') {
      viewer.innerHTML = '<div class="content-table">' + data.html + '</div>';
      setupTabs(viewer);
    } else {
      viewer.innerHTML = '<div class="content-html">' + data.html + '</div>';
    }
  } catch(e) {
    viewer.innerHTML = '<div class="error-msg">&#9888; ' + esc(e.message) + '</div>';
  }
}
function setupTabs(viewer) {
  var tabs = viewer.querySelectorAll('.sheet-tab');
  var btns = viewer.querySelectorAll('.tab-btn');
  if (!tabs.length) return;
  tabs[0].classList.add('visible');
  btns.forEach(function(btn, i) {
    btn.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('visible'); });
      btns.forEach(function(b) { b.classList.remove('active'); });
      tabs[i].classList.add('visible');
      btn.classList.add('active');
    });
  });
}

/* ═══════════════════════════════════════
   INIT
   ═══════════════════════════════════════ */
(async function init() {
  var meta = await fetch('/api/meta').then(function(r) { return r.json(); });
  if (meta.dir) { loadTree(); }
  else { openPicker(false); }
})();
</script>
</body>
</html>`;

app.get("/", (_req, res) => res.send(HTML));

app.listen(port, () => {
  console.log(`\n  docview running at  http://localhost:${port}`);
  if (docsDir) console.log(`  Serving directory:  ${docsDir}`);
  else         console.log(`  No directory set — pick one in the browser`);
  console.log();
});
