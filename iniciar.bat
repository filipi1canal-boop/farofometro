@echo off
title Farofometro - Servidor

echo.
echo  ==========================================
echo    FAROFOMETRO - Iniciando Servidor
echo  ==========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  ERRO: Node.js nao encontrado!
  echo  Baixe em: https://nodejs.org
  echo  Apos instalar, REINICIE o PC e tente novamente.
  echo.
  pause
  exit /b 1
)

echo  Node.js encontrado:
node --version
echo.

if not exist node_modules (
  echo  Instalando dependencias (primeira vez)...
  echo.
  npm install
  echo.
)

echo  Iniciando servidor...
echo  Para encerrar: pressione CTRL+C
echo.
node server.js
echo.
echo  O servidor encerrou. Pressione qualquer tecla para fechar.
pause
