#!/usr/bin/env bash
# share.sh <master.mp4> — نسخة للتسليم: 1080p، H.264، أقل من ٣٠ ميجا (حدّ إرسال الملفات). تُخرج <name>-share.mp4
set -euo pipefail
IN="${1:?}"; OUT="${IN%.mp4}-share.mp4"; CRF=22
while :; do
  ffmpeg -v error -y -i "$IN" -c:v libx264 -crf $CRF -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart "$OUT"
  SZ=$(stat -c %s "$OUT"); [ "$SZ" -lt 29000000 ] && break; CRF=$((CRF+2)); [ $CRF -gt 32 ] && break
done
echo "✓ $OUT  $((SZ/1048576)) MB  (crf $CRF)"
