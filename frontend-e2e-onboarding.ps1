[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$FrontendPath,

  [string]$SeedArtifactsPath = ".\seed-artifacts.json",

  [string]$BackendBaseUrl  = "http://localhost:4000",
  [string]$FrontendBaseUrl = "http://localhost:3000",

  [int]$BackendPort  = 4000,
  [int]$FrontendPort = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-Port {
  param([string]$HostName, [int]$Port, [int]$TimeoutMs = 300)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { $client.Close(); return $false }
    $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch { return $false }
}

function Wait-Port {
  param([string]$HostName, [int]$Port, [int]$Seconds = 60, [string]$Name = "service")
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Port -HostName "localhost" -Port $Port) { return $true }
    Start-Sleep -Milliseconds 500
  }
  throw "Timed out waiting for $Name on $HostName`:$Port"
}

function Start-NpmDevIfNeeded {
  param([string]$Name,[string]$WorkDir,[int]$Port,[string[]]$Args=@("run","dev"))
  if (Test-Port -HostName "localhost" -Port $Port) {
    Write-Host "[OK] $Name already running on :$Port"
    return
  }
  if (-not (Test-Path $WorkDir)) { throw "Missing $Name directory: $WorkDir" }
  Write-Host "[RUN] Starting $Name in $WorkDir"
  Start-Process -FilePath "npm" -ArgumentList $Args -WorkingDirectory $WorkDir -WindowStyle Minimized | Out-Null
  Wait-Port -HostName "localhost" -Port $Port -Seconds 90 -Name $Name
  Write-Host "[OK] $Name is up on :$Port"
}

if (-not (Test-Path $FrontendPath)) { throw "FrontendPath not found: $FrontendPath" }

$ScriptRoot  = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendPath = $ScriptRoot

Start-NpmDevIfNeeded -Name "Backend"  -WorkDir $BackendPath  -Port $BackendPort
Start-NpmDevIfNeeded -Name "Frontend" -WorkDir $FrontendPath -Port $FrontendPort

if (-not (Test-Path $SeedArtifactsPath)) { throw "Seed artifacts file not found: $SeedArtifactsPath" }

$seed = Get-Content $SeedArtifactsPath -Raw | ConvertFrom-Json

# Your seed-artifacts.json has base like http://localhost:4000/api
$baseFromSeed = $seed.base
if ($baseFromSeed) {
  # Normalize to host root
  $BackendBaseUrl = $baseFromSeed -replace "/api$",""
}

$studentToken = $seed.student.token
if (-not $studentToken) { throw "student.token missing in seed-artifacts.json" }

$headers = @{ Authorization = "Bearer $studentToken" }

Write-Host "[INFO] Using student token from seed-artifacts.json"
Write-Host "[INFO] BackendBaseUrl = $BackendBaseUrl"
Write-Host "[INFO] FrontendBaseUrl = $FrontendBaseUrl"

# Fetch courses
Write-Host "[STEP] GET /api/courses"
$coursesResp = Invoke-RestMethod -Method GET -Uri "$BackendBaseUrl/api/courses" -Headers $headers

# Handle wrapped shape: { ok: true, courses: [...] }
$courses = $null
if ($coursesResp.courses) { $courses = $coursesResp.courses }
elseif ($coursesResp.data) { $courses = $coursesResp.data }
else { $courses = $coursesResp }

if (-not $courses) { throw "Backend returned no courses." }

$first = ($courses | Select-Object -First 1)
$keys = $first.PSObject.Properties.Name
Write-Host ("[INFO] Course keys detected: " + ($keys -join ", "))

$courseTitle = $null
foreach ($f in @("title","name","courseTitle","courseName","label","slug")) {
  if ($keys -contains $f -and $first.$f) { $courseTitle = [string]$first.$f; break }
}
Write-Host "[OK] Sample course label:"
Write-Host $courseTitle

# Frontend check
Write-Host "[STEP] GET /courses (frontend render)"
$page = Invoke-WebRequest -Uri "$FrontendBaseUrl/courses" -UseBasicParsing
if ($page.StatusCode -ne 200) { throw "Frontend /courses returned HTTP $($page.StatusCode)" }

if ($courseTitle -and ($page.Content -notmatch [Regex]::Escape($courseTitle))) {
  throw "Frontend /courses loaded but did not show the backend course label. Label: $courseTitle"
}

Write-Host "[PASS] E2E OK: token + backend courses + frontend rendered courses."