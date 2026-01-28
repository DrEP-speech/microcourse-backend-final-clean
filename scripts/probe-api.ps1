param(
  [string]$ApiBase = "http://localhost:4000/api",
  [string]$ArtifactsPath = ".\seed-artifacts.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Root-FromApiBase([string]$api) {
  if ($api -match "/api/?$") { return ($api -replace "/api/?$","") }
  return $api.TrimEnd("/")
}
function Read-JsonFile([string]$p) {
  if (-not (Test-Path $p)) { return $null }
  $raw = Get-Content $p -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  try { return ($raw | ConvertFrom-Json) } catch { return $null }
}
function Get-Token([object]$art, [string]$role) {
  if ($null -eq $art) { return $null }
  try {
    if ($role -eq "student" -and $art.student -and $art.student.token) { return [string]$art.student.token }
    if ($role -eq "instructor" -and $art.instructor -and $art.instructor.token) { return [string]$art.instructor.token }
  } catch {}
  try {
    if ($role -eq "student" -and $art.studentToken) { return [string]$art.studentToken }
    if ($role -eq "instructor" -and $art.instructorToken) { return [string]$art.instructorToken }
  } catch {}
  return $null
}
function Invoke-ApiRaw {
  param(
    [ValidateSet("GET","POST","PUT","PATCH","DELETE")] [string]$Method,
    [string]$Url,
    [hashtable]$Headers = @{},
    $Body = $null
  )
  if ($null -eq $Headers -or -not ($Headers -is [hashtable])) { $Headers = @{} }
  if (-not $Headers.ContainsKey("Accept")) { $Headers["Accept"] = "application/json" }

  $jsonBody = $null
  if ($null -ne $Body) { $jsonBody = ($Body | ConvertTo-Json -Depth 30) }

  $resp = $null
  try {
    if ($null -ne $jsonBody) {
      $resp = Invoke-WebRequest -SkipHttpErrorCheck -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body $jsonBody
    } else {
      $resp = Invoke-WebRequest -SkipHttpErrorCheck -Method $Method -Uri $Url -Headers $Headers
    }
  } catch {
    return [pscustomobject]@{ status=0; ok=$false; url=$Url; text=($_.Exception.Message | Out-String).Trim(); contentType=""; isJson=$false }
  }

  $status = [int]$resp.StatusCode
  $text = $resp.Content
  $ct = ($resp.Headers["Content-Type"] | Out-String).Trim()
  $isJson = $false
  if ($text) {
    $t = $text.TrimStart()
    if ($ct -match "json" -or $t.StartsWith("{") -or $t.StartsWith("[")) { $isJson = $true }
  }

  return [pscustomobject]@{
    status = $status
    ok = ($status -ge 200 -and $status -lt 300)
    url = $Url
    contentType = $ct
    isJson = $isJson
    text = $text
  }
}

$root = Root-FromApiBase $ApiBase
Write-Host "ROOT: $root" -ForegroundColor Cyan
Write-Host "API:  $ApiBase" -ForegroundColor Cyan

$health = Invoke-ApiRaw -Method GET -Url "$root/health"
Write-Host ("Health {0}: {1}" -f $health.status, ($health.text -replace "`r","" -replace "`n"," " | Select-Object -First 1)) -ForegroundColor Green

$art = Read-JsonFile $ArtifactsPath
if (-not $art) { throw "Artifacts missing/unreadable: $ArtifactsPath" }

$studentJwt = Get-Token $art "student"
$instrJwt = Get-Token $art "instructor"
if (-not $studentJwt) { throw "Missing student token in artifacts." }
if (-not $instrJwt) { Write-Host "[WARN] Missing instructor token in artifacts." -ForegroundColor Yellow }

$HStud = @{ Authorization="Bearer $studentJwt"; Accept="application/json" }
$HInst = if ($instrJwt) { @{ Authorization="Bearer $instrJwt"; Accept="application/json" } } else { $null }

# Candidate endpoints to probe
$courseCreateBody = @{
  title="Probe Course"
  description="Probe create course"
  status="published"
  visibility="public"
  isPublished=$true
}

$routes = @()

# whoami / me routes
$routes += [pscustomobject]@{ group="ME(student)"; method="GET"; url="$ApiBase/me"; headers=$HStud; body=$null }
$routes += [pscustomobject]@{ group="ME(student)"; method="GET"; url="$ApiBase/users/me"; headers=$HStud; body=$null }
$routes += [pscustomobject]@{ group="ME(student)"; method="GET"; url="$ApiBase/auth/me"; headers=$HStud; body=$null }
if ($HInst) {
  $routes += [pscustomobject]@{ group="ME(instr)"; method="GET"; url="$ApiBase/me"; headers=$HInst; body=$null }
  $routes += [pscustomobject]@{ group="ME(instr)"; method="GET"; url="$ApiBase/users/me"; headers=$HInst; body=$null }
  $routes += [pscustomobject]@{ group="ME(instr)"; method="GET"; url="$ApiBase/auth/me"; headers=$HInst; body=$null }
}

# list courses as student
$routes += [pscustomobject]@{ group="COURSES(list student)"; method="GET"; url="$ApiBase/courses"; headers=$HStud; body=$null }
$routes += [pscustomobject]@{ group="COURSES(list student)"; method="GET"; url="$ApiBase/course"; headers=$HStud; body=$null }

# create course as instructor (common variants)
if ($HInst) {
  foreach ($u in @(
    "$ApiBase/courses",
    "$ApiBase/course",
    "$ApiBase/instructor/courses",
    "$ApiBase/instructors/courses",
    "$ApiBase/admin/courses",
    "$ApiBase/courses/create",
    "$ApiBase/course/create",
    "$ApiBase/courses/new"
  )) {
    $routes += [pscustomobject]@{ group="COURSE(create instr)"; method="POST"; url=$u; headers=$HInst; body=$courseCreateBody }
  }
}

# Run probes
$results = @()
foreach ($r in $routes) {
  $resp = Invoke-ApiRaw -Method $r.method -Url $r.url -Headers $r.headers -Body $r.body
  $snippet = ""
  if ($resp.text) {
    $snippet = ($resp.text -replace "`r","" -replace "`n"," ")
    if ($snippet.Length -gt 160) { $snippet = $snippet.Substring(0,160) + "..." }
  }
  $results += [pscustomobject]@{
    Group = $r.group
    Method = $r.method
    Url = $r.url
    Status = $resp.status
    OK = $resp.ok
    JsonLike = $resp.isJson
    ContentType = $resp.contentType
    Snippet = $snippet
  }
}

$results | Sort-Object Group, Method, Url | Format-Table -AutoSize
