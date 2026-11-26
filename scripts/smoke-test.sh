#!/usr/bin/env bash
# Check a running PlayTerminal container over HTTP: pages, redirects, the 404 page, the VM
# files, content types, gzip and cache headers.
# Usage: scripts/smoke-test.sh [BASE_URL]   (default http://localhost:8090)
set -euo pipefail

BASE=${1:-http://localhost:8090}
FAILED=0
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# get PATH [curl args...]: fetch BASE/PATH; headers into $TMP/h, body into $TMP/b.
get() {
    local path=$1
    shift
    curl -sS -o "$TMP/b" -D "$TMP/h" "$@" "$BASE$path"
}
status() { head -1 "$TMP/h" | cut -d' ' -f2; }
header() { grep -i "^$1:" "$TMP/h" | head -1 | cut -d' ' -f2- | tr -d '\r'; }
check() {
    local what=$1
    shift
    if "$@"; then
        echo "ok    $what"
    else
        echo "FAIL  $what"
        FAILED=1
    fi
}

get /
check "/ is 200" test "$(status)" = 200
check "/ is the main page" grep -q '<title>PlayTerminal' "$TMP/b"
check "/ has the security headers" test "$(header X-Content-Type-Options)" = nosniff
check "/ revalidates" test "$(header Cache-Control)" = no-cache
asset=$(grep -o '/_astro/[^"]*\.css' "$TMP/b" | head -1)

get /about
check "/about redirects to /about/ (relative)" \
    test "$(status) $(header Location)" = "301 /about/"

get /about/
check "/about/ is 200" test "$(status)" = 200

get /game/robots/ -H 'Accept-Encoding: gzip' --compressed
check "/game/robots/ is 200" test "$(status)" = 200
check "/game/robots/ is gzipped" test "$(header Content-Encoding)" = gzip
check "/game/robots/ has its game config" grep -q 'id="game-config"' "$TMP/b"

get /game/pong/
check "/game/pong/ is 404" test "$(status)" = 404
check "/game/pong/ shows the 404 page" grep -q 'Not found' "$TMP/b"

get "$asset"
check "$asset is 200 and cached for good" \
    test "$(status) $(header Cache-Control)" = "200 max-age=315360000"
check "$asset has the security headers" test "$(header X-Frame-Options)" = SAMEORIGIN

get /licenses/xterm.txt
check "/licenses/xterm.txt is text" test "$(header Content-Type)" = "text/plain; charset=utf-8"

get /v86/config.mjs
check "/v86/config.mjs is JavaScript" \
    test "$(status) $(header Content-Type)" = "200 application/javascript; charset=utf-8"
check "/v86/config.mjs revalidates" test "$(header Cache-Control)" = no-cache
fsjson=$(grep -o 'fs-[0-9a-f]*\.json' "$TMP/b")
snapshot=$(grep -o 'state-[0-9a-f]*\.bin\.zst' "$TMP/b")

get /v86/libv86.js -H 'Accept-Encoding: gzip'
check "/v86/libv86.js is gzipped" test "$(header Content-Encoding)" = gzip

get /v86/v86.wasm -H 'Accept-Encoding: gzip'
check "/v86/v86.wasm is wasm, gzipped" \
    test "$(header Content-Type) $(header Content-Encoding)" = "application/wasm gzip"

get "/v86/$fsjson" -H 'Accept-Encoding: gzip'
check "/v86/$fsjson is gzipped and cached for good" \
    test "$(header Content-Encoding) $(header Cache-Control)" = "gzip max-age=315360000"

get "/v86/$snapshot" -I -H 'Accept-Encoding: gzip'
check "/v86/$snapshot is 200, not gzipped, cached for good" \
    test "$(status) $(header Content-Encoding) $(header Cache-Control)" = "200  max-age=315360000"

get /v86/THIRD-PARTY.txt
check "/v86/THIRD-PARTY.txt is 200" test "$(status)" = 200

if [[ $FAILED != 0 ]]; then
    echo "Smoke test failed"
    exit 1
fi
echo "Smoke test passed"
