@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === מעשר ישר — חיבור לטלפון ===
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "IP=%%a"
  goto :gotip
)
:gotip
set IP=%IP: =%

if "%IP%"=="" (
  echo לא נמצא IP. וודא שהמחשב מחובר לרשת.
  pause
  exit /b 1
)

echo IP של המחשב: %IP%
echo וודא שהטלפון באותו Wi-Fi כמו הראוטר של הבית.
echo.
echo אחרי שהברקוד מופיע — סרוק מתוך Expo Go.
echo.

set REACT_NATIVE_PACKAGER_HOSTNAME=%IP%
npx expo start --lan -c
