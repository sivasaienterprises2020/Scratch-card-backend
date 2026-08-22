@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)

if not exist .env copy .env.example .env >nul

echo Installing backend packages...
call npm install
if errorlevel 1 (
  echo Package installation failed.
  pause
  exit /b 1
)

echo.
echo Setup completed.
echo Open .env and add your rotated Neon DATABASE_URL and secure secrets.
echo Then run: npm run dev
pause
