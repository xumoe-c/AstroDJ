@echo off
cd /d "%~dp0"

set GOOS=js
set GOARCH=wasm
go build -ldflags="-s -w" -o ..\frontend\public\wasm\main.wasm .
if errorlevel 1 (
    echo Build failed
    exit /b 1
)

for /f "delims=" %%i in ('go env GOROOT') do set GOROOT=%%i

if exist "%GOROOT%\lib\wasm\wasm_exec.js" (
    copy /y "%GOROOT%\lib\wasm\wasm_exec.js" ..\frontend\public\wasm\
) else if exist "%GOROOT%\misc\wasm\wasm_exec.js" (
    copy /y "%GOROOT%\misc\wasm\wasm_exec.js" ..\frontend\public\wasm\
) else (
    echo ERROR: wasm_exec.js not found in GOROOT=%GOROOT%
    exit /b 1
)

echo Build complete: main.wasm + wasm_exec.js -^> frontend\public\wasm\
