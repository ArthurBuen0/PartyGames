@echo off
chcp 65001 >nul
title Sorteia Ai - servidor local

rem Entra na pasta deste arquivo (funciona mesmo com espacos e acentos no caminho)
cd /d "%~dp0"

echo.
echo   ==========================================
echo     Sorteia Ai - servidor local
echo   ==========================================
echo.
echo   Pasta: %CD%
echo.

rem Procura um runtime disponivel, em ordem de preferencia
where python >nul 2>nul
if %errorlevel%==0 goto usar_python

where py >nul 2>nul
if %errorlevel%==0 goto usar_py

where node >nul 2>nul
if %errorlevel%==0 goto usar_node

echo   [X] Nao encontrei Python nem Node neste computador.
echo.
echo   Alternativa sem instalar nada:
echo     abra a pasta no VS Code, clique com o botao direito
echo     no index.html e escolha "Open with Live Server".
echo.
pause
exit /b 1

:usar_python
echo   Servidor: python -m http.server 8080
goto subir

:usar_py
echo   Servidor: py -m http.server 8080
goto subir

:usar_node
echo   Servidor: npx serve
echo.
echo   -^> Abra no navegador o endereco que aparecer abaixo.
echo   -^> Para parar, aperte Ctrl+C.
echo.
npx --yes serve . -l 8080
exit /b 0

:subir
echo.
echo   -^> Abrindo http://localhost:8080 no navegador...
echo   -^> Para parar o servidor, aperte Ctrl+C nesta janela.
echo.
start "" http://localhost:8080

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8080
) else (
  py -m http.server 8080
)

echo.
echo   Servidor encerrado.
pause
