#!/usr/bin/env bash
# render.sh <svg-dir> <png-dir> [name-prefix]: screenshots each SVG at 1920x1080 with headless Edge.
set -u
SVGDIR="$1"; PNGDIR="$2"; PREFIX="${3:-}"
mkdir -p "$PNGDIR"
for f in "$SVGDIR"/${PREFIX}*.svg; do
  n="$(basename "$f" .svg)"
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
    --user-data-dir="$PNGDIR/edge-profile-$n" --window-size=1920,1080 --screenshot="$PNGDIR/$n.png" "file:///$(cygpath -m "$f")" >/dev/null 2>&1
  ls -l "$PNGDIR/$n.png" | awk '{print $5, $9}'
done
