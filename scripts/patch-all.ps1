Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBomFile([string]$Path, [string]$Content) {
  $dir = Split-Path $Path -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

# Always anchor paths to project root
$Root = Get-Location

function P([string]$rel) {
  return Join-Path $Root $rel
}

# Ensure scripts folder exists
New-Item -ItemType Directory -Force (P "scripts") | Out-Null

# --- Fix scripts/Invoke-Api.ps1 ---
Write-Section "Patching scripts/Invoke-Api.ps1"

Write-Utf8NoBomFile (P "scripts\Invoke-Api.ps1") @"
Set-StrictMode -Version Latest
`$ErrorActionPreference = "Stop"

function Get-ErrorBodyText(`$err) {
  try {
    `$resp = `$err.Exception.Response
    if (`$null -eq `$resp) { return `$null }

    if (`$resp -is [System.Net.Http.HttpResponseMessage]) {
      try { return `$resp.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch { return `$null }
    }

    if (`$resp -is [System.Net.WebResponse]) {
      try {
        `$stream = `$resp.GetResponseStream()
        if (`$null -eq `$stream) { return `$null }
        `$reader = New-Object System.IO.StreamReader(`$stream)
        `$text = `$reader.ReadToEnd()
        `$reader.Dispose()
        return `$text
      } catch { return `$null }
    }

    return `$null
  } catch {
    return `$null
  }
}

function Invoke-Api {
  param(
    [Parameter(Mandatory=`$true)][ValidateSet("GET","POST","PUT","DELETE","PATCH")][string]`$Method,
    [Parameter(Mandatory=`$true)][string]`$Url,
    [hashtable]`$Headers = @{},
    [string]`$JsonBody = `$null,
    [int]`$TimeoutSec = 30
  )

  try {
    `$params = @{
      Method      = `$Method
      Uri         = `$Url
      Headers     = `$Headers
      TimeoutSec  = `$TimeoutSec
    }

    if (`$JsonBody) {
      `$params["ContentType"] = "application/json"
      `$params["Body"] = `$JsonBody
    }

    return Invoke-RestMethod @params
  } catch {
    `$status = `$null
    try { `$status = `$_.Exception.Response.StatusCode.value__ } catch { }
    `$bodyText = Get-ErrorBodyText `$_
    `$msg = "HTTP failure calling `$Method `$Url"
    if (`$status) { `$msg += " (status `$status)" }
    if (`$bodyText) { `$msg += "`n`$bodyText" }
    throw `$msg
  }
}
"@

Write-Host "✅ Patched scripts/Invoke-Api.ps1" -ForegroundColor Green

# --- Add scripts/e2e-auth-smoke.ps1 ---
Write-Section "Adding scripts/e2e-auth-smoke.ps1"

Write-Utf8NoBomFile (P "scripts\e2e-auth-smoke.ps1") @"
Set-StrictMode -Version Latest
`$ErrorActionPreference = "Stop"

. "`$PSScriptRoot\Invoke-Api.ps1"

`$base = "http://localhost:4000"

`$stamp = Get-Date -Format "yyyyMMddHHmmss"
`$email = "student+`$stamp@example.com"
`$pass  = "Password123!"
`$name  = "Smoke Student `$stamp"

Write-Host "Registering: `$email" -ForegroundColor Cyan

`$regBody = @{
  email = `$email
  password = `$pass
  name = `$name
  role = "student"
} | ConvertTo-Json -Depth 10

try {
  `$reg = Invoke-Api -Method POST -Url "`$base/api/auth/register" -JsonBody `$regBody
  `$reg | ConvertTo-Json -Depth 10
} catch {
  Write-Host `$_ -ForegroundColor Yellow
}

Write-Host "Logging in: `$email" -ForegroundColor Cyan

`$loginBody = @{
  email = `$email
  password = `$pass
} | ConvertTo-Json -Depth 10

`$login = Invoke-Api -Method POST -Url "`$base/api/auth/login" -JsonBody `$loginBody
`$login | ConvertTo-Json -Depth 10

`$token = `$null
if (`$login.PSObject.Properties.Name -contains "token") { `$token = `$login.token }
if (-not `$token -and (`$login.PSObject.Properties.Name -contains "data") -and `$login.data) {
  if (`$login.data.PSObject.Properties.Name -contains "token") { `$token = `$login.data.token }
}
if (-not `$token -and (`$login.PSObject.Properties.Name -contains "accessToken")) { `$token = `$login.accessToken }

if (-not `$token) { throw "Token not found in login response." }

`$h = @{ Authorization = "Bearer `$token" }

Write-Host "`n=== /api/auth/me ===" -ForegroundColor Cyan
Invoke-Api -Method GET -Url "`$base/api/auth/me" -Headers `$h | ConvertTo-Json -Depth 10

Write-Host "`n=== /api/progress/me ===" -ForegroundColor Cyan
Invoke-Api -Method GET -Url "`$base/api/progress/me" -Headers `$h | ConvertTo-Json -Depth 10

Write-Host "`n=== /api/dashboard ===" -ForegroundColor Cyan
Invoke-Api -Method GET -Url "`$base/api/dashboard" -Headers `$h | ConvertTo-Json -Depth 10

Write-Host "`n✅ Auth smoke complete." -ForegroundColor Green
"@

Write-Host "✅ Added scripts/e2e-auth-smoke.ps1" -ForegroundColor Green
Write-Host "Done. Next: run .\scripts\patch-all.ps1" -ForegroundColor Green
