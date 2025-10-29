@echo off
set "TASKNAME=Microcourse_Newman_Hourly"
set "WORKDIR=C:\Users\eddwa\Downloads\microcourse-backend-final-clean"
set "LOGFILE=%WORKDIR%\newman-log.txt"

schtasks /Query /TN "%TASKNAME%" >nul 2>&1
if %ERRORLEVEL%==0 schtasks /Delete /TN "%TASKNAME%" /F

REM Note: >> appends; 2>&1 captures stderr too
schtasks /Create ^
  /TN "%TASKNAME%" ^
  /TR "cmd.exe /c newman-run.bat >> \"%LOGFILE%\" 2>&1" ^
  /SC HOURLY ^
  /ST 09:00 ^
  /RL LIMITED ^
  /F ^
  /RI 60 ^
  /WD "%WORKDIR%"

schtasks /Run /TN "%TASKNAME%"
echo Created hourly task with logging to: %LOGFILE%
