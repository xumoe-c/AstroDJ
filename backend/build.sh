#!/bin/bash
set -e

cd "$(dirname "$0")"

GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o ../frontend/public/wasm/main.wasm .

GOROOT=$(go env GOROOT)
if [ -f "$GOROOT/lib/wasm/wasm_exec.js" ]; then
  cp "$GOROOT/lib/wasm/wasm_exec.js" ../frontend/public/wasm/
elif [ -f "$GOROOT/misc/wasm/wasm_exec.js" ]; then
  cp "$GOROOT/misc/wasm/wasm_exec.js" ../frontend/public/wasm/
else
  echo "ERROR: wasm_exec.js not found in GOROOT=$GOROOT"
  exit 1
fi

echo "Build complete: main.wasm + wasm_exec.js -> frontend/public/wasm/"
