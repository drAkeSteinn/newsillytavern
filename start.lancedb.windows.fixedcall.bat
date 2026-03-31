@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

set "LOGFILE=start-log.txt"

echo ========================================= > "%LOGFILE%"
echo LanceDB Windows start log >> "%LOGFILE%"
echo ========================================= >> "%LOGFILE%"
echo. >> "%LOGFILE%"

echo =========================================
echo Iniciando proyecto con LanceDB en Windows
echo =========================================
echo Se guardara un log en: %LOGFILE%
echo.

where node >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :node_missing

where npm >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :npm_missing

if not exist "node_modules" (
  echo ERROR: No existe node_modules. Ejecuta install.bat primero.
  echo ERROR: No existe node_modules. Ejecuta install.bat primero. >> "%LOGFILE%"
  pause
  exit /b 1
)

if not exist "data" mkdir data >> "%LOGFILE%" 2>&1
if not exist "data\lancedb" mkdir "data\lancedb" >> "%LOGFILE%" 2>&1

set "LANCEDB_PLATFORM=win32-x64-msvc"
echo [INFO] LANCEDB_PLATFORM=%LANCEDB_PLATFORM%
echo [INFO] LANCEDB_PLATFORM=%LANCEDB_PLATFORM%>> "%LOGFILE%"

echo [1/4] Verificando LanceDB...
call node -e "import('@lancedb/lancedb').then(function(){console.log('LanceDB OK');}).catch(function(e){console.error(e);process.exit(1);})" >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :err

echo [2/4] Prisma generate...
call npx --yes prisma@6.19.2 generate >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :err

echo [3/4] Prisma db push...
call npx --yes prisma@6.19.2 db push >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :err

echo [4/4] Iniciando servidor...
echo URL: http://localhost:3000
call npm run dev:win >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :err

pause
exit /b 0

:node_missing
echo ERROR: Node.js no esta instalado o no esta en PATH.
pause
exit /b 1

:npm_missing
echo ERROR: npm no esta disponible en PATH.
pause
exit /b 1

:err
echo.
echo ERROR: No se pudo iniciar el proyecto.
echo Revisa el archivo %LOGFILE%
echo.
type "%LOGFILE%"
pause
exit /b 1
