@echo off
setlocal
pushd "C:\Users\eddwa\Downloads\microcourse-backend-final-clean"

rem timestamp safe for filenames
for /f "tokens=1-4 delims=/:. " %%a in ("%date% %time%") do set STAMP=%%a-%%b-%%c_%%d
set "OUTDIR=logs"
if not exist "%OUTDIR%" mkdir "%OUTDIR%"

set "RUNLOG=%OUTDIR%\newman-%STAMP%.log"

rem write to a per-run log (no global lock)
call newman-run.bat > "%RUNLOG%" 2>&1

rem append the finished run to the rolling log
type "%RUNLOG%" >> newman-log.txt

popd
endlocal

