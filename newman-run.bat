@echo off
setlocal enabledelayedexpansion

REM === Config ===
set "COLLECTION=Microcourse_Auth_AllEnvs_withFlow.postman_collection.json"
set "ENVFILE=Microcourse_AllEnvs.postman_environment.json"
set "DATAFILE=postman_runner_data.csv"

REM Rotation settings
set "MAX_REPORTS=10"          REM keep last N timestamped HTML reports
set "MAX_LOG_MB=5"            REM truncate log when it grows past this (MB)
set "TRIM_TAIL_LINES=8000"    REM keep only the last N lines when truncating

REM === Resolve paths ===
set "ROOT=%~dp0"
if not exist "%COLLECTION%" set "COLLECTION=%ROOT%%COLLECTION%"
if not exist "%ENVFILE%"   set "ENVFILE=%ROOT%%ENVFILE%"
if not exist "%DATAFILE%"  set "DATAFILE=%ROOT%%DATAFILE%"

set "LOGFILE=%ROOT%newman-log.txt"

REM === Timestamp for report names ===
for /f "tokens=1-4 delims=:.," %%h in ("%time%") do (
  set hh=0%%h
  set hh=!hh:~-2!
  set mi=0%%i
  set mi=!mi:~-2!
)
REM Get yyyy-mm-dd from %date% regardless of locale via PowerShell (robust)
for /f %%A in ('powershell -NoProfile -Command "(Get-Date).ToString(\"yyyy-MM-dd\")"') do set YMD=%%A
set "STAMP=%YMD%_%hh%%mi%"
set "REPORT_TS=%ROOT%newman-report-%STAMP%.html"
set "REPORT_LATEST=%ROOT%newman-report.html"

REM === Log header ===
>> "%LOGFILE%" echo ====================== [%date% %time%] RUN START ======================
>> "%LOGFILE%" echo Collection: %COLLECTION%
>> "%LOGFILE%" echo Environment: %ENVFILE%
>> "%LOGFILE%" echo Data: %DATAFILE%

REM === Ensure newman + reporter installed ===
where newman >nul 2>&1
if errorlevel 1 (
  echo Installing newman...>>"%LOGFILE%"
  npm install -g newman >> "%LOGFILE%" 2>&1
)

node -e "require('newman-reporter-htmlextra')" >nul 2>&1
if errorlevel 1 (
  echo Installing htmlextra reporter...>>"%LOGFILE%"
  npm i -g newman-reporter-htmlextra >> "%LOGFILE%" 2>&1
)

REM === Run the collection ===
newman run "%COLLECTION%" ^
  --environment "%ENVFILE%" ^
  --iteration-data "%DATAFILE%" ^
  --reporters cli,htmlextra ^
  --reporter-htmlextra-export "%REPORT_TS%" ^
  --reporter-htmlextra-title "Microcourse Auth Monitor %STAMP%" >> "%LOGFILE%" 2>&1

REM Keep a copy as latest
copy /Y "%REPORT_TS%" "%REPORT_LATEST%" >nul

>> "%LOGFILE%" echo [%date% %time%] RUN END

REM === Rotation: delete old timestamped reports beyond MAX_REPORTS ===
powershell -NoProfile -Command ^
  "Get-ChildItem -LiteralPath '%ROOT%' -Filter 'newman-report-*.html' | Sort-Object LastWriteTime -Descending | Select-Object -Skip %MAX_REPORTS% | Remove-Item -Force -ErrorAction SilentlyContinue"

REM === Rotation: truncate log if over MAX_LOG_MB ===
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Set-Location 'C:\Users\eddwa\Downloads\microcourse-backend-final-clean'; ^
   & .\newman-run.bat 2>&1 | Tee-Object -FilePath '.\newman-log.txt' -Append"

echo Done. Report: %REPORT_TS%
if exist "%REPORT_LATEST%" start "" "%REPORT_LATEST%"

endlocal
