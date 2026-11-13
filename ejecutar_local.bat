@echo off
title OperaLog - Servidor Local (PLUZ)
cd /d "%~dp0"
echo ===================================================
echo   OperaLog - Capacidad Operativa BT (PLUZ)
echo ===================================================
if not exist "node_modules" (
  echo [1/2] Instalando dependencias por primera vez...
  call npm install
)
echo [2/2] Iniciando servidor local en http://localhost:5173 ...
start "" http://localhost:5173
call npm run dev
pause
