Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Try-Req {
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [int]$TimeoutSec = 90
  )

  Write-Host ""
  Write-Host "==> $Url" -ForegroundColor Cyan

  try {
    $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -SkipHttpErrorCheck -UseBasicParsing
    Write-Host ("Status: {0}" -f [int]$resp.StatusCode) -ForegroundColor Green
    if ($resp.Headers) {
      $keys = @("date","server","content-type","x-render-origin-server","via","cf-ray","x-cache","x-served-by")
      foreach ($k in $keys) {
        if ($resp.Headers[$k]) { Write-Host ("{0}: {1}" -f $k, $resp.Headers[$k]) -ForegroundColor DarkGray }
      }
    }
    if ($resp.Content) {
      $snippet = $resp.Content
      if ($snippet.Length -gt 300) { $snippet = $snippet.Substring(0,300) + "..." }
      Write-Host "BodySnippet: $snippet" -ForegroundColor DarkYellow
    }
  }
  catch {
    Write-Host ("ERROR: {0}" -f $_.Exception.GetType().FullName) -ForegroundColor Red
    Write-Host ("MSG:   {0}" -f $_.Exception.Message) -ForegroundColor Red
    if ($_.Exception.InnerException) {
      Write-Host ("INNER: {0}" -f $_.Exception.InnerException.Message) -ForegroundColor DarkRed
    }
  }
}

$Base = $env:SMOKE_BASEURL
if ([string]::IsNullOrWhiteSpace($Base)) {
  $Base = "https://microcourse-backend-final-clean.onrender.com"
}
$Base = $Base.TrimEnd("/")

Write-Host "Base: $Base" -ForegroundColor Cyan
Write-Host "PowerShell: $($PSVersionTable.PSVersion)" -ForegroundColor DarkGray

# TCP reachability (you already did this, but we keep it inside the probe)
$hostName = ($Base -replace '^https?://','').Split('/')[0]
Write-Host ""
Write-Host "==> TCP 443 check ($hostName)" -ForegroundColor Cyan
Test-NetConnection $hostName -Port 443 | Select-Object ComputerName,RemoteAddress,RemotePort,TcpTestSucceeded

# HTTP endpoints to try
$urls = @(
  "$Base/",
  "$Base/health",
  "$Base/api/health",
  "$Base/api",
  "$Base/api/courses"
)

foreach ($u in $urls) { Try-Req -Url $u -TimeoutSec 90 }

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
