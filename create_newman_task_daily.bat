@echo off
setlocal

REM Change these if needed
set TASKNAME=Microcourse_Newman_Daily
set WORKDIR=C:\Users\eddwa\Downloads\microcourse-backend-final-clean
set LOGFILE=%WORKDIR%\newman-log.txt

REM Delete old task if exists
SCHTASKS /DELETE /TN "%TASKNAME%" /F >nul 2>&1

REM Create new daily task (9:00 AM, runs as admin)
SCHTASKS /CREATE ^
  /TN "%TASKNAME%" ^
  /TR "cmd /c \"cd /d %WORKDIR% && newman-run.bat >> newman-log.txt 2>&1\"" ^
  /SC DAILY /ST 09:00 ^
  /RL HIGHEST ^
  /F

echo Created daily task with logging to: %LOGFILE%
endlocal
