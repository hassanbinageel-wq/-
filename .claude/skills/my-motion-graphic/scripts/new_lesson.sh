#!/usr/bin/env bash
# new_lesson.sh <folder> [example] — ينشئ درسًا/فيلمًا جديدًا في motion-studio/films/<folder> مع المقدّم والمكتبة وأمثلة الدروس.
# example: arkan-iman (افتراضي) | ihsan | arkan-islam | arkan-kids — يُنسخ كنقطة بداية فقط؛ الفكرة البصرية يجب أن تُستبدل بفكرة جديدة.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; STUDIO="$ROOT/motion-studio"
NAME="${1:?اسم المجلد مطلوب}"; EX="${2:-arkan-iman}"; DIR="$STUDIO/films/$NAME"
mkdir -p "$STUDIO/films"
[ -f "$STUDIO/package.json" ] || cp "$SKILL/templates/package.json" "$STUDIO/package.json"
[ -d "$STUDIO/node_modules/@fontsource/baloo-bhaijaan-2" ] || (cd "$STUDIO" && npm i --silent)
mkdir -p "$DIR"/{lib,assets/vo,out}
cp "$SKILL/lib/motion.js" "$DIR/lib/"
cp "$SKILL/assets/presenter/"*.png "$DIR/assets/"
[ -f "$DIR/film.html" ] || cp "$SKILL/examples/$EX/film.html" "$DIR/film.html"
[ -f "$DIR/timing.py" ] || cp "$SKILL/examples/$EX/timing.py" "$DIR/timing.py"
[ -f "$DIR/audio.py" ] || sed "s#\.\./\.\./\.\./\.claude/skills/motion-studio/scripts#../../../.claude/skills/my-motion-graphic/scripts#" "$SKILL/examples/$EX/audio.py" > "$DIR/audio.py"
[ -e "$DIR/node_modules" ] || ln -s ../../node_modules "$DIR/node_modules"
printf 'out/\nnode_modules\n' > "$DIR/.gitignore"
echo "✓ $DIR  (ارفع الصوت إلى assets/vo ثم: python3 $SKILL/scripts/align_whisper.py assets/vo/voice.wav)"
