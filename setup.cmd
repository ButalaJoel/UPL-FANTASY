@echo off
REM Double-click this file on Windows, or run "setup" in the VS Code terminal.
cd /d "%~dp0"
node scripts\setup.mjs %*
if errorlevel 1 pause
