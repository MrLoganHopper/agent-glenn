@echo off
setlocal
cd /d "%~dp0"
set DEMO_DRY_RUN=true
start "" http://localhost:8787
node src\server.mjs
endlocal
