Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Get-RoutesFromFile([string]$FilePath) {
  $txt = Get-Content $FilePath -Raw

  $hits = @()

  # match router.get("/x", ...), router.post('/x', ...)
  $rx = [regex]::new("router\.(get|post|put|delete|patch)\s*\(\s*(['""])(?<path>.*?)\2", "IgnoreCase")
  foreach ($m in $rx.Matches($txt)) {
    $hits += [pscustomobject]@{
      File   = (Split-Path $FilePath -Leaf)
      Method = $m.Groups[1].Value.ToUpper()
      Path   = $m.Groups["path"].Value
    }
  }

  # match app.use("/api/auth", require("./routes/auth"))
  $ux = [regex]::new("app\.use\s*\(\s*(['""])(?<mount>.*?)\1\s*,\s*require\((['""])(?<mod>.*?)\3\)", "IgnoreCase")
  $mounts = @()
  foreach ($m in $ux.Matches($txt)) {
    $mounts += [pscustomobject]@{ Mount=$m.Groups["mount"].Value; Module=$m.Groups["mod"].Value }
  }

  return [pscustomobject]@{ Routes=$hits; Mounts=$mounts }
}

Write-Section "Route audit (file-based)"
$root = Get-Location

$routesDir = Join-Path $root "routes"
$serverFile = Join-Path $root "server.js"

if (-not (Test-Path $routesDir)) { throw "Missing routes/: $routesDir" }
if (-not (Test-Path $serverFile)) { Write-Host "WARN: server.js not found at $serverFile" -ForegroundColor Yellow }

$allRoutes = @()
Get-ChildItem -Path $routesDir -Filter *.js | ForEach-Object {
  $r = Get-RoutesFromFile -FilePath $_.FullName
  $allRoutes += $r.Routes
}

Write-Section "Top routes (first 80)"
$allRoutes | Sort-Object File, Method, Path | Select-Object -First 80 | Format-Table -AutoSize

Write-Section "Route count by file"
$allRoutes | Group-Object File | Sort-Object Count -Descending | Select-Object Name,Count | Format-Table -AutoSize

Write-Section "DONE"