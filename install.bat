@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

set "LOGFILE=install-log.txt"

echo ========================================= > "%LOGFILE%"
echo LanceDB Windows installer log >> "%LOGFILE%"
echo ========================================= >> "%LOGFILE%"
echo. >> "%LOGFILE%"

echo =========================================
echo Instalando proyecto con LanceDB en Windows
echo =========================================
echo Se guardara un log en: %LOGFILE%
echo.

echo [INFO] Carpeta actual: %CD%
echo [INFO] Carpeta actual: %CD%>> "%LOGFILE%"

where node >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :node_missing

where npm >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :npm_missing

echo [INFO] Versiones detectadas:
call node -v
call npm -v
echo [INFO] Versiones detectadas:>> "%LOGFILE%"
call node -v >> "%LOGFILE%" 2>&1
call npm -v >> "%LOGFILE%" 2>&1

if not exist ".env.local" (
  echo [INFO] Creando .env.local
  (
    echo LLM_API_URL=http://127.0.0.1:5000/v1/chat/completions
    echo LLM_MODEL=local-model
    echo LLM_TEMPERATURE=0.7
    echo LLM_MAX_TOKENS=2048
    echo DATABASE_URL=file:./prisma/dev.db
  ) > ".env.local"
) else (
  echo [INFO] .env.local ya existe
)

if not exist ".env" (
  echo [INFO] Creando .env
  (
    echo DATABASE_URL=file:./prisma/dev.db
  ) > ".env"
) else (
  echo [INFO] .env ya existe
)

if not exist "data" mkdir data >> "%LOGFILE%" 2>&1
if not exist "data\lancedb" mkdir "data\lancedb" >> "%LOGFILE%" 2>&1

echo.
echo [1/6] Instalando dependencias npm...
echo [1/6] npm install --include=optional >> "%LOGFILE%"
call npm install --include=optional >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :err

echo.
echo [2/6] Verificando paquete LanceDB...
echo [2/6] npm ls @lancedb/lancedb >> "%LOGFILE%"
call npm ls @lancedb/lancedb >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :err

echo.
echo [3/6] Verificando binario Windows de LanceDB...
echo [3/6] npm ls @lancedb/lancedb-win32-x64-msvc >> "%LOGFILE%"
call npm ls @lancedb/lancedb-win32-x64-msvc >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :err

echo.
echo [4/6] Importando LanceDB con Node...
echo [4/6] node -e import >> "%LOGFILE%"
call node -e "import('@lancedb/lancedb').then(function(){console.log('LanceDB OK');}).catch(function(e){console.error(e);process.exit(1);})" >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :err

echo.
echo [5/6] Prisma generate...
echo [5/6] prisma generate >> "%LOGFILE%"
call npx --yes prisma@6.19.2 generate >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :err

echo.
echo [6/6] Prisma db push...
echo [6/6] prisma db push >> "%LOGFILE%"
call npx --yes prisma@6.19.2 db push >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :err

echo.
echo =========================================
echo Instalacion completada correctamente
echo Carpeta LanceDB: data\lancedb
echo Revisa %LOGFILE% si quieres el detalle
echo =========================================
echo. >> "%LOGFILE%"
echo Instalacion completada correctamente >> "%LOGFILE%"
pause
exit /b 0

:node_missing
echo.
echo ERROR: Node.js no esta instalado o no esta en PATH.
echo ERROR: Node.js no esta instalado o no esta en PATH. >> "%LOGFILE%"
echo Abre CMD y ejecuta: node -v
pause
exit /b 1

:npm_missing
echo.
echo ERROR: npm no esta disponible en PATH.
echo ERROR: npm no esta disponible en PATH. >> "%LOGFILE%"
echo Abre CMD y ejecuta: npm -v
pause
exit /b 1

:err
echo.
echo =========================================
echo ERROR: La instalacion fallo.
echo Revisa el archivo %LOGFILE%
echo =========================================
echo.
type "%LOGFILE%"
pause
exit /b 1
