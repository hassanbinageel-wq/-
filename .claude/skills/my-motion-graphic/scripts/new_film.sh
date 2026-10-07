#!/usr/bin/env bash
# new_film.sh <name> — ينشئ مجلد فيلم جديد داخل motion-studio/films/ من القالب المحايد
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
STUDIO="${STUDIO:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)/motion-studio}"
NAME="${1:?اسم الفيلم مطلوب}"
DIR="$STUDIO/films/$NAME"
[ -e "$DIR" ] && { echo "✗ $DIR موجود"; exit 1; }
[ -d "$STUDIO/node_modules" ] || (cd "$STUDIO" && npm i --silent)
mkdir -p "$DIR"/{lib,assets,refs,out}
cp "$SKILL/templates/film.html" "$DIR/film.html"
cp "$SKILL/lib/motion.js" "$DIR/lib/motion.js"
ln -s ../../node_modules "$DIR/node_modules"
cat > "$DIR/audio.py" <<'PY'
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../.claude/skills/my-motion-graphic/scripts'))
from audio_kit import Kit
k = Kit(dur=4, bpm=120)
music, sfx = k.bus(), k.bus()
for n in range(8): music.add(k.kick(.8), k.beat(n))
k.finish([music, sfx], os.path.join(os.path.dirname(__file__), 'out/score.wav'))
PY
for f in brief style_guide shotlist; do echo "# $NAME — $f" > "$DIR/$f.md"; done
echo "✓ $DIR"
