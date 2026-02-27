@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"
title ウェルカム天使大作戦 - スマホで見る用サーバー

echo.
echo ========================================
echo   スマホでこのアプリを開く手順
echo ========================================
echo.

REM ローカルIPを表示（Wi-FiのIPv4）
set "IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "IP=%%a"
  set "IP=!IP: =!"
  goto :found_ip
)
:found_ip
if defined IP (
  echo   PCのIPアドレス: !IP!
  echo   ポート: 5000
  echo.
  echo   スマホでブラウザを開き、次のURLを入力してください:
  echo.
  echo   http://!IP!:5000
  echo.
  echo   ※スマホとPCは同じWi-Fiに接続してください
  echo.
) else (
  echo   IPアドレスを取得できませんでした。
  echo   手動で ipconfig を実行し、IPv4アドレスを確認してください。
  echo   その後、スマホで http://[そのIP]:5000 を開いてください。
  echo.
)

echo ========================================
echo   サーバーを起動しています...
echo   終了するときはこの窓を閉じてください。
echo ========================================
echo.

set HOST=0.0.0.0
npx -y serve . -l 5000
pause
