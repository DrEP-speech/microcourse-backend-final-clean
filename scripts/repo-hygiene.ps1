. "$PSScriptRoot\_utils.ps1"

Write-Host "Repo hygiene: enforcing UTF-8 (no BOM) + LF for text files..." -ForegroundColor Cyan

$extensions = @("*.js","*.jsx","*.ts","*.tsx","*.json","*.md","*.yml","*.yaml","*.env","*.txt")
$files = foreach ($ext in $extensions) {
  Get-ChildItem -Path (Resolve-Path "$PSScriptRoot\..") -Recurse -File -Filter $ext -ErrorAction SilentlyContinue
}

$files = $files | Where-Object {
  $_.FullName -notmatch "\\node_modules\\" -and
  $_.FullName -notmatch "\\dist\\" -and
  $_.FullName -notmatch "\\build\\" -and
  $_.FullName -notmatch "\\\.next\\" -and
  $_.FullName -notmatch "\\coverage\\" -and
  $_.FullName -notmatch "\\app\\"
}
$changed = 0
foreach ($f in $files) {
  try {
    $content = [System.IO.File]::ReadAllText($f.FullName)
    # Rewrite using our canonical writer
    Write-TextUtf8NoBom $f.FullName $content -Newline "LF"

    # Confirm no BOM
    Assert-NoBom -Path $f.FullName
    $changed++
  } catch {
    Write-Host "FAILED: $($f.FullName)" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    throw
  }
}

Write-Host "Hygiene complete. Processed: $changed files" -ForegroundColor Green