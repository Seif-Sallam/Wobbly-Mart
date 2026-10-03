#!/usr/bin/env bash
# Offline: builds public/audio/sfx.mp3 (one sprite), src/audio/sprite.json and public/audio/music.mp3.
# Needs ffmpeg. KENNEY = folder with the unzipped Kenney audio packs; FS = folder with the Freesound/OGA downloads
# (see CREDITS.md for each source URL). Run: KENNEY=… FS=… scripts/build-audio.sh
set -euo pipefail
: "${KENNEY:?set KENNEY}" "${FS:?set FS}"
OUT=public/audio
TMP=$(mktemp -d)
mkdir -p "$OUT"
k() { find "$KENNEY/$1" -name "$2" | head -1; }
enc() { ffmpeg -v error -y "$@" -ac 1 -ar 44100 -c:a pcm_s16le; }

# name | ffmpeg input + filters
enc -i "$(k interface-sounds pluck_001.ogg)" "$TMP/pop.wav"
enc -i "$(k interface-sounds drop_002.ogg)" "$TMP/plop.wav"
enc -i "$(k interface-sounds tick_002.ogg)" "$TMP/tick.wav"
enc -i "$(k interface-sounds confirmation_002.ogg)" "$TMP/ding.wav"
enc -i "$(k digital-audio phaseJump1.ogg)" "$TMP/boing.wav"
enc -i "$(k music-jingles jingles_PIZZI00.ogg)" "$TMP/jingle.wav"
enc -i "$(k impact-sounds impactMetal_light_000.ogg)" -i "$(k impact-sounds impactBell_heavy_001.ogg)" -i "$(k rpg-audio handleCoins.ogg)" \
  -filter_complex "[1]asetrate=44100*1.5,aresample=44100,adelay=90,volume=1.3[b];[2]adelay=40,volume=0.8[c];[0][b][c]amix=3:normalize=0,atrim=0:1.1,afade=t=out:st=0.8:d=0.3" "$TMP/kaching.wav"
enc -i "$(k casino-audio chip-lay-1.ogg)" "$TMP/bill.wav"
enc -i "$(k digital-audio powerUp2.ogg)" "$TMP/powerup.wav"
enc -i "$FS/170808.mp3" -af "atrim=0:1.7,afade=t=out:st=1.4:d=0.3" "$TMP/cluck.wav"
enc -i "$FS/184831.mp3" -af "atrim=7.44:9.06,asetpts=PTS-STARTPTS,afade=t=out:st=1.3:d=0.3" "$TMP/moo.wav"
enc -i "$(k interface-sounds error_006.ogg)" -af "asetrate=44100*0.6,aresample=44100" "$TMP/grumble.wav"
enc -i "$(k impact-sounds impactPunch_heavy_000.ogg)" -af "asetrate=44100*0.8,aresample=44100" "$TMP/splat.wav"
enc -i "$(k rpg-audio cloth1.ogg)" "$TMP/swish.wav"
enc -i "$(k impact-sounds impactPlank_medium_000.ogg)" "$TMP/bonk.wav"
enc -i "$(k ui-audio click1.ogg)" "$TMP/click.wav"
enc -i "$(k music-jingles jingles_PIZZI10.ogg)" "$TMP/fanfare.wav"
# made here: party horn, van honk, machine hum
enc -f lavfi -i "aevalsrc='0.35*sgn(sin(2*PI*(420+260*t+18*sin(2*PI*9*t))*t))':d=0.7" -af "lowpass=2500,afade=t=in:d=0.03,afade=t=out:st=0.55:d=0.15" "$TMP/horn.wav"
enc -f lavfi -i "aevalsrc='0.3*sgn(sin(2*PI*392*t))+0.3*sgn(sin(2*PI*494*t))':d=0.55" -af "lowpass=1800,volume=0.8,afade=t=out:st=0.4:d=0.15,apad=pad_dur=0.12,aloop=loop=1:size=29700" "$TMP/honk.wav"
enc -f lavfi -i "aevalsrc='0.25*sin(2*PI*90*t)+0.12*sin(2*PI*180*t+sin(2*PI*6*t))':d=1" -af "lowpass=600" "$TMP/hum.wav"

NAMES=(pop plop tick ding boing jingle kaching bill powerup cluck moo grumble splat swish bonk click fanfare horn honk hum)
# Join raw 16-bit mono PCM with silent gaps; offsets are exact sample counts.
python3 - "$TMP" "${NAMES[@]}" <<'PY'
import json, subprocess, sys
tmp, names = sys.argv[1], sys.argv[2:]
rate, gap = 44100, b"\0\0" * int(44100 * 0.15)
out, sprite = bytearray(), {}
for n in names:
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", f"{tmp}/{n}.wav", "-f", "s16le", "-ac", "1", "-ar", str(rate), "-"], capture_output=True, check=True).stdout
    sprite[n] = [round(len(out) / 2 / rate * 1000), round(len(pcm) / 2 / rate * 1000)]
    out += pcm + gap
open(f"{tmp}/all.raw", "wb").write(out)
open("src/audio/sprite.json", "w").write(json.dumps(sprite, indent=2) + "\n")
PY
ffmpeg -v error -y -f s16le -ar 44100 -ac 1 -i "$TMP/all.raw" -c:a libmp3lame -b:a 64k "$OUT/sfx.mp3"
ffmpeg -v error -y -i "$FS/bouncy.mp3" -ac 1 -ar 44100 -c:a libmp3lame -b:a 64k "$OUT/music.mp3"
ls -la "$OUT"
