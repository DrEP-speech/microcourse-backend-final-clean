param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$server = Join-Path $Root "server.js"
if (!(Test-Path $server)) {
  Write-Host "WARN: server.js not found at project root. Manually mount:" -ForegroundColor Yellow
  Write-Host "  app.use('/api/results', require('./src/routes/resultRoutes'))" -ForegroundColor Yellow
  exit 0
}

$content = Get-Content -Raw $server
$needle = "app.use('/api/results', require('./src/routes/resultRoutes'))"

if ($content -match [regex]::Escape($needle)) {
  Write-Host "OK: results route already mounted." -ForegroundColor Green
  exit 0
}

if ($content -match "app\.use\('/api/quizzes'") {
  $content = $content -replace "(app\.use\('/api/quizzes'[^\r\n]*\)[^\r\n]*\r?\n)", "`$1$needle`r`n"
} elseif ($content -match "app\.listen\(") {
  $content = $content -replace "(app\.listen\()", "$needle`r`n`r`n`$1"
} else {
  $content = $content + "`r`n" + $needle + "`r`n"
}

Set-Content -Encoding UTF8 -Path $server -Value $content
Write-Host "Mounted /api/results in server.js" -ForegroundColor Green
