param(
  [string]$EnvPath = ".\.env"
)

if (!(Test-Path $EnvPath)) { throw "Env file not found: $EnvPath" }

Get-Content $EnvPath | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $parts = $line.Split("=", 2)
  if ($parts.Count -ne 2) { return }

  $name  = $parts[0].Trim()
  $value = $parts[1].Trim()

  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  Set-Item -Path "Env:$name" -Value $value
}

Write-Host "Loaded env from $EnvPath" -ForegroundColor Green
