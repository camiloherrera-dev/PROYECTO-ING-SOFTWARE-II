@echo off
setlocal
cd /d "%~dp0"
if not exist test-results mkdir test-results
call npm.cmd test > test-results\latest.log 2>&1
set "TEST_EXIT=%ERRORLEVEL%"
type test-results\latest.log
echo %TEST_EXIT%> test-results\exit-code.txt
echo.
echo Codigo de salida: %TEST_EXIT%
echo Resultado guardado en test-results\latest.log
exit /b %TEST_EXIT%
