#!/usr/bin/env bash
# Starts folium on a folder of sample files and checks the rendering and security basics.
#
# Usage: scripts/smoke-test.sh <command that runs folium>
#   scripts/smoke-test.sh node folium.js
#   scripts/smoke-test.sh dist/folium-0.2.0-linux-x64/folium
set -euo pipefail

DIR="$(mktemp -d)"
printf '# Привіт\n\n<img src=x onerror="alert(1)">\n' > "$DIR/test.md"
printf '<p>hi</p>' > "$DIR/test.html"
printf 'a\tb\n1\t2,5\n' > "$DIR/test.tsv"
printf '<?xml version="1.0" encoding="windows-1251"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Збірка</book-title></title-info></description><body><section><p>Їжачок є</p></section></body></FictionBook>' \
  | iconv -f utf-8 -t windows-1251 > "$DIR/book.fb2"
(cd "$DIR" && zip -q book.fbz book.fb2)
E="$DIR/epub-src" && mkdir -p "$E/META-INF" "$E/OEBPS"
printf 'application/epub+zip' > "$E/mimetype"
printf '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/book.opf"/></rootfiles></container>' > "$E/META-INF/container.xml"
printf '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="a" href="a.xhtml"/><item id="b" href="b.xhtml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>' > "$E/OEBPS/book.opf"
printf '<html><body><p>Розділ один <img src="p.png"/></p></body></html>' > "$E/OEBPS/a.xhtml"
printf '<html><body><p>Розділ два</p></body></html>' > "$E/OEBPS/b.xhtml"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC' | base64 -d > "$E/OEBPS/p.png"
(cd "$E" && zip -qX "$DIR/book.epub" mimetype META-INF/container.xml OEBPS/*)
# A sibling folder whose name starts with the served folder's name must stay unreachable.
mkdir -p "${DIR}-private" && echo secret > "${DIR}-private/secret.txt"

"$@" "$DIR" --port 4000 >/dev/null &
trap 'kill $!' EXIT
sleep 2

fail() { echo "smoke test failed: $*" >&2; exit 1; }
BASE="http://127.0.0.1:4000"
R="$BASE/api/render?path="
curl -fsS "${R}test.md" | grep -q 'Привіт'                       || fail "markdown"
! curl -fsS "${R}test.md" | grep -q 'onerror'                     || fail "markdown not sanitized"
curl -fsSI "$BASE/api/raw?path=test.html" | grep -qi 'content-security-policy: sandbox' || fail "html sandbox header"
curl -fsS "${R}test.tsv" | grep -q '>2,5<'                        || fail "tsv"
curl -fsS "${R}book.fb2" | grep -q 'Збірка'                       || fail "fb2"
curl -fsS "${R}book.fbz" | grep -q 'Їжачок є'                     || fail "fbz"
curl -fsS "${R}book.epub&chapter=1" | grep -q 'Розділ два'      || fail "epub"
[[ "$(curl -fsS -o /dev/null -w '%{content_type}' "$BASE/api/epub-asset?path=book.epub&entry=OEBPS/p.png")" == image/png ]] || fail "epub image"
[[ "$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: evil.example' "$BASE/api/files")" == 403 ]] || fail "foreign Host header accepted"
! curl -s "${R}../$(basename "$DIR")-private/secret.txt" | grep -q secret || fail "file outside the folder readable"
! curl -s "$BASE/api/raw?path=../$(basename "$DIR")-private/secret.txt" | grep -q secret || fail "file outside the folder readable"
echo "smoke test passed"
