#!/bin/sh
# tests/check_android_sources.sh -- the Android APK must compile the same C as
# the desktop build. tools/saepack-android.sh passes every src/*.c to the
# cross build; .build.ae lists its C sources by name. When the two disagree an
# APK links but dies at launch with a missing symbol (sae_raster.c, then
# sae_prelude.c, each added to .build.ae and not to the APK). This holds the
# lists equal.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT" || exit 1
desk=$(grep -o 'sources("src/[^"]*\.c")' .build.ae | sed 's/sources("//; s/")//' | sort)
tree=$(ls src/*.c | sort)
if [ "$desk" = "$tree" ]; then
    echo "ok   .build.ae and the APK compile the same C: $(echo $tree | tr '\n' ' ')"
    exit 0
fi
echo "FAIL .build.ae's C sources and src/*.c differ (the APK takes src/*.c):"
echo "  .build.ae: $(echo $desk | tr '\n' ' ')"
echo "  src/*.c:   $(echo $tree | tr '\n' ' ')"
exit 1
