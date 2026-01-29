Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BaseUrl = $env:SMOKE_BASEURL
if ([string]::IsNullOrWhiteSpace($BaseUrl)) { $BaseUrl = "http://localhost:4000" }
$BaseUrl = $BaseUrl.TrimEnd("/")

Write-Host "BaseUrl: $BaseUrl" -ForegroundColor Cyan

$urls = @("$BaseUrl/health", "$BaseUrl/api/health")
foreach ($u in $urls) {
  try {
    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 20
    Write-Host ("OK {0} -> {1}" -f $u, $r.StatusCode) -ForegroundColor Green
    Write-Host ($r.Content)
  } catch {
    Write-Host ("FAIL {0} -> {1}" -f $u, $_.Exception.Message) -ForegroundColor Red
  }
}
