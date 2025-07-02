@echo off
setlocal enabledelayedexpansion

echo 🔨 Building GitHub Merge Conflict Helper...

REM Get version from manifest.json
for /f "tokens=2 delims=:" %%a in ('findstr "version" manifest.json') do (
    set "version_line=%%a"
)
set "version_line=!version_line:~1!"
set "version_line=!version_line: =!"
set "version_line=!version_line:~1,-2!"
set "VERSION=!version_line!"

echo 📋 Version: !VERSION!

REM Clean up previous builds
if exist builds rmdir /s /q builds
mkdir builds\debug
mkdir builds\production

echo 📁 Creating build directories...

REM Copy files to builds (excluding unnecessary files)
echo 🐛 Creating debug build...
xcopy /s /e /i /q /exclude:build-exclude.txt . builds\debug >nul 2>&1

echo 🚀 Creating production build...
xcopy /s /e /i /q /exclude:build-exclude.txt . builds\production >nul 2>&1

echo ⚙️  Configuring debug modes...

REM Configure debug build (ensure DEBUG_MODE = true)
powershell -Command "(Get-Content builds\debug\content.js) -replace 'const DEBUG_MODE = false;', 'const DEBUG_MODE = true;' | Set-Content builds\debug\content.js"

REM Configure production build (ensure DEBUG_MODE = false)  
powershell -Command "(Get-Content builds\production\content.js) -replace 'const DEBUG_MODE = true;', 'const DEBUG_MODE = false;' | Set-Content builds\production\content.js"

echo 📦 Creating ZIP files...

REM Create ZIP files using PowerShell
powershell -Command "Compress-Archive -Path 'builds\debug\*' -DestinationPath 'builds\github-merge-helper-v!VERSION!-debug.zip' -Force"
powershell -Command "Compress-Archive -Path 'builds\production\*' -DestinationPath 'builds\github-merge-helper-v!VERSION!-production.zip' -Force"

echo ✅ Verifying builds...
echo Debug build:
findstr "const DEBUG_MODE" builds\debug\content.js

echo Production build:
findstr "const DEBUG_MODE" builds\production\content.js

echo.
echo ✨ Build complete!
echo.
echo 📁 Files created:
echo   🐛 Debug: builds\github-merge-helper-v!VERSION!-debug.zip
echo   🚀 Production: builds\github-merge-helper-v!VERSION!-production.zip
echo.
echo 🚀 Upload the production ZIP to Chrome Web Store
echo 🐛 Use the debug ZIP for development testing

pause
