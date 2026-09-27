@echo off
setlocal
cd /d "%~dp0"
if not exist .env (
  echo Missing .env file.
  echo Run: copy .env.example .env
  echo Then add your Twilio and ElevenLabs credentials.
  pause
  exit /b 1
)
start "" http://localhost:8787
node src\server.mjs
endlocal
