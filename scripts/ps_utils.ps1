Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host ("=== {0} ===" -f $Title) -ForegroundColor Cyan
}

function Write-Ok([string]$Text)   { Write-Host ("[OK]  {0}" -f $Text) -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host ("[!]   {0}" -f $Text) -ForegroundColor Yellow }
function Write-Fail([string]$Text) { Write-Host ("[X]   {0}" -f $Text) -ForegroundColor Red }

function Get-BaseUrl {
  if ($env:BASE_URL -and $env:BASE_URL.Trim().Length -gt 0) { return $env:BASE_URL.Trim().TrimEnd("/") }
  return "http://localhost:4000"
}

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    $Body = $null,
    [int[]]$ExpectedStatus = @(200)
  )

  $args = @{ Method=$Method; Uri=$Url; Headers=$Headers }
  if ($null -ne $Body) {
    $args["ContentType"] = "application/json"
    $args["Body"] = ($Body | ConvertTo-Json -Depth 25)
  }

  $resp = Invoke-WebRequest @args -SkipHttpErrorCheck
  $code = [int]$resp.StatusCode

  if ($ExpectedStatus -notcontains $code) {
    $snippet = ""
    try { $snippet = $resp.Content } catch { $snippet = "" }
    throw "HTTP $code unexpected for $Method $Url. Body: $snippet"
  }

  $json = $null
  if ($resp.Content -and $resp.Content.Trim().StartsWith("{")) {
    try { $json = $resp.Content | ConvertFrom-Json } catch { $json = $null }
  }

  [pscustomobject]@{ Status=$code; Raw=$resp.Content; Json=$json; Headers=$resp.Headers }
}
