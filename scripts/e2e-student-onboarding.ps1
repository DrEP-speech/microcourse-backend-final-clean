param(
  [string]$ApiBase = "http://localhost:4000/api",
  [string]$ArtifactsPath = ".\seed-artifacts.json",
  [string]$SeedScriptPath = ".\seed-onboarding.ps1"
)

$ErrorActionPreference = "Stop"

function Assert($cond, $msg){
  if(-not $cond){ throw $msg }
}

function TryHttpJson {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers = $null,
    $Body = $null
  )
  try {
    $invokeParams = @{
      Method = $Method
      Uri    = $Url
      Headers = $Headers
    }
    if ($null -ne $Body) {
      $invokeParams.ContentType = "application/json"
      $invokeParams.Body = $Body
    }

    $resp = Invoke-WebRequest @invokeParams -UseBasicParsing
    $ct = ($resp.Headers["Content-Type"] | Select-Object -First 1)

    $raw = $resp.Content
    $json = $null
    if ($raw -and ($ct -match "json" -or $raw.Trim().StartsWith("{") -or $raw.Trim().StartsWith("["))) {
      try { $json = $raw | ConvertFrom-Json } catch { $json = $null }
    }
    return @{ ok = $true; status = $resp.StatusCode; json = $json; raw = $raw; url = $Url }
  } catch {
    $ex = $_.Exception
    $status = 0
    $raw = $null
    if ($ex.Response) {
      try { $status = [int]$ex.Response.StatusCode } catch { $status = 0 }
      try {
        $sr = New-Object System.IO.StreamReader($ex.Response.GetResponseStream())
        $raw = $sr.ReadToEnd()
      } catch { $raw = $null }
    }
    $json = $null
    if ($raw -and ($raw.Trim().StartsWith("{") -or $raw.Trim().StartsWith("["))) {
      try { $json = $raw | ConvertFrom-Json } catch { $json = $null }
    }
    return @{ ok = $false; status = $status; json = $json; raw = $raw; url = $Url; error = $ex.Message }
  }
}

function LoadArtifacts {
  param([string]$Path)
  Assert (Test-Path $Path) "Artifacts file missing: $Path (run seed)"
  $raw = Get-Content $Path -Raw
  $art = $raw | ConvertFrom-Json
  return $art
}

function GetStudentCourses {
  param([string]$Base, [string]$Jwt)

  $h = @{ Authorization = "Bearer $Jwt" }

  # Primary endpoint that you already proved works
  $r = TryHttpJson -Method "GET" -Url "$Base/courses" -Headers $h
  if (-not $r.ok) { return @{ ok=$false; items=@(); resp=$r } }

  $items = @()

  # Handle shapes:
  # 1) { ok:true, items:[...] }
  # 2) { items:[...] }
  # 3) [...]  (array)
  if ($r.json -is [System.Array]) {
    $items = @($r.json)
  } elseif ($r.json -and $r.json.items) {
    $items = @($r.json.items)
  } elseif ($r.json -and $r.json.ok -and $r.json.items) {
    $items = @($r.json.items)
  }

  return @{ ok=$true; items=$items; resp=$r }
}

Write-Host "=== E2E Student Onboarding Path ===
# --- artifacts fallback (PS5.1-safe) ---
$ArtifactsPath = Join-Path $PSScriptRoot "..\seed-artifacts.json"
$ArtifactsExample = Join-Path $PSScriptRoot "..\seed-artifacts.example.json"
if (-not (Test-Path $ArtifactsPath) -and (Test-Path $ArtifactsExample)) {
  Copy-Item -Force $ArtifactsExample $ArtifactsPath
  Write-Host "[AUTOHEAL] seed-artifacts.json missing; copied from seed-artifacts.example.json (tokens will be generated/overwritten by seed)." -ForegroundColor Yellow
}
# --- end fallback ---
" -ForegroundColor Cyan
Write-Host ("API Base:  " + $ApiBase)
Write-Host ("Artifacts: " + $ArtifactsPath)
Write-Host ("Seed:      " + $SeedScriptPath)
Write-Host ""

# [0] Health
Write-Host "=== [0] Health ===" -ForegroundColor Cyan
$health = TryHttpJson -Method "GET" -Url "$ApiBase/health"
if ($health.ok -and $health.json) {
  Write-Host ("Health ok: " + ($health.raw.Trim())) -ForegroundColor Green
} else {
  throw ("Health failed: " + (if ($null -ne $health.error) { $health.error } else { $health.raw }))
}
Write-Host ""

# [A] Load artifacts / tokens (or seed if missing)
Write-Host "=== [A] Load artifacts / tokens ===" -ForegroundColor Cyan
$art = $null
if (Test-Path $ArtifactsPath) {
  $art = LoadArtifacts $ArtifactsPath
}

$needSeed = $false
if (-not $art) { $needSeed = $true }
elseif (-not $art.student -or -not $art.student.token) { $needSeed = $true }
elseif (-not $art.instructor -or -not $art.instructor.token) { $needSeed = $true }

if ($needSeed) {
  Write-Host "[AUTOHEAL] Missing artifacts/tokens. Running seed..." -ForegroundColor Yellow
  powershell -NoProfile -ExecutionPolicy Bypass -File $SeedScriptPath -ApiBase $ApiBase -ArtifactsPath $ArtifactsPath | Out-Host
  $art = LoadArtifacts $ArtifactsPath
}

Assert ($art.student -and $art.student.token) "Missing student token in artifacts"
Assert ($art.instructor -and $art.instructor.token) "Missing instructor token in artifacts"

$studentJwt = $art.student.token
$instructorJwt = $art.instructor.token

Write-Host "JWT loaded (student)." -ForegroundColor Green
Write-Host "JWT loaded (instructor)." -ForegroundColor Green
Write-Host ""

# [1] Fetch student-visible courses
Write-Host "=== [1] Fetch courses (student) ===" -ForegroundColor Cyan
$c = GetStudentCourses -Base $ApiBase -Jwt $studentJwt

if (-not $c.ok) {
  throw ("Courses fetch failed: " + (if ($null -ne $c.resp.error) { $c.resp.error } else { $c.resp.raw }))
}

Write-Host ("Courses returned: " + $c.items.Count)

# If none, attempt seed once, then retry
if ($c.items.Count -eq 0) {
  Write-Host "[AUTOHEAL] 0 courses. Running seed once, then retry..." -ForegroundColor Yellow
  powershell -NoProfile -ExecutionPolicy Bypass -File $SeedScriptPath -ApiBase $ApiBase -ArtifactsPath $ArtifactsPath | Out-Host
  $art = LoadArtifacts $ArtifactsPath
  $studentJwt = $art.student.token

  $c = GetStudentCourses -Base $ApiBase -Jwt $studentJwt
  Write-Host ("Courses returned (after seed): " + $c.items.Count)
}

Assert ($c.items.Count -gt 0) "No courses available for student after seed."

$first = $c.items | Select-Object -First 1

# Defensive: some course docs use title/slug, others use name, etc.
$title = $first.title
if (-not $title) { $title = $first.name }
$slug = $first.slug
$id = $first._id

Write-Host ""
Write-Host ("[DONE] Student can see onboarding course: " + $title) -ForegroundColor Green
Write-Host ("      id:   " + $id)
if ($slug) { Write-Host ("      slug: " + $slug) }

exit 0


