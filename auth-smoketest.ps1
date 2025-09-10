# auth-smoketest.ps1
# End-to-end: discover working auth base, fetch CSRF, ensure XSRF cookie, POST /signup, GET /me

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Json {
  param(
    [Parameter(Mandatory)][string]$Url,
    [ValidateSet('GET','POST','PUT','PATCH','DELETE')][string]$Method = 'GET',
    [string]$Body,
    [hashtable]$Headers,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )
  if ($Body) {
    return Invoke-RestMethod -Uri $Url -Method $Method -ContentType 'application/json' `
      -Headers $Headers -Body $Body -WebSession $Session -TimeoutSec 15 -ErrorAction Stop
  } else {
    return Invoke-RestMethod -Uri $Url -Method $Method `
      -Headers $Headers -WebSession $Session -TimeoutSec 15 -ErrorAction Stop
  }
}

function Show-Cookies {
  param([Parameter(Mandatory)][Uri]$Uri, [Parameter(Mandatory)][Microsoft.PowerShell.Commands.WebRequestSession]$Session)
  $Session.Cookies.GetCookies($Uri) | ForEach-Object {
    '{0}={1}; Path={2}; Domain={3}; Secure={4}; HttpOnly={5}' -f $_.Name,$_.Value,$_.Path,$_.Domain,$_.Secure,$_.HttpOnly
  }
}

function Find-AuthBase {
  param([string[]]$Ports, [string]$Host = 'localhost')
  # Add/adjust path candidates if your API mounts elsewhere:
  $paths = @('', '/auth', '/api/auth')
  foreach ($p in $Ports) {
    foreach ($path in $paths) {
      $base = "http://$Host:$p$path"
      $csrfUrl = "$base/csrf"
      try {
        $probe = Invoke-RestMethod -Uri $csrfUrl -Method GET -TimeoutSec 4 -ErrorAction Stop
        if ($probe.csrfToken) {
          return [pscustomobject]@{ Base = $base; CsrfUrl = $csrfUrl }
        }
      } catch { }
    }
  }
  throw "CSRF endpoint not found on any probed base. Tried: $(
    ($Ports | ForEach-Object { $pt=$_; $paths | ForEach-Object { "http://$Host:$pt$_/csrf" } }) -join ', '
  )"
}

# Candidate ports: current PORT, then common ones
$ports = @()
if ($env:PORT) { $ports += $env:PORT }
$ports += 5001,5000
$ports = $ports | Where-Object { $_ } | Select-Object -Unique

# Web session with cookie jar
$S = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Discover /csrf
$found = Find-AuthBase -Ports $ports
$Base    = $found.Base
$CsrfUrl = $found.CsrfUrl
Write-Host "Using BASE: $Base"
Write-Host "CSRF URL:  $CsrfUrl"

# Fetch csrfToken (and any cookies set by server)
$csrf  = Invoke-Json -Url $CsrfUrl -Session $S
$TOKEN = $csrf.csrfToken
if (-not $TOKEN) { throw "Server did not return csrfToken" }

# Compute absolute origin URI (PowerShell cookie APIs require absolute root)
$baseUri = [Uri]$Base
$cookieUri = [Uri]("{0}://{1}:{2}/" -f $baseUri.Scheme, $baseUri.Host, $baseUri.Port)

# Ensure XSRF-TOKEN cookie exists and matches the header we'll send
$xsrf = $S.Cookies.GetCookies($cookieUri) | Where-Object Name -eq 'XSRF-TOKEN'
if (-not $xsrf) {
  $c = New-Object System.Net.Cookie('XSRF-TOKEN', $TOKEN, '/', $cookieUri.Host)
  $S.Cookies.Add($cookieUri, $c)
}

Write-Host "Cookies on $($cookieUri.AbsoluteUri):"
Show-Cookies -Uri $cookieUri -Session $S | Write-Host

# Signup
$EMAIL = "tester$([int](Get-Random -Minimum 100000 -Maximum 999999))@example.com"
$BODY  = @{ name='Tester'; email=$EMAIL; password='secret123' } | ConvertTo-Json -Depth 3
$signupUrl = "$Base/signup"

$signup = Invoke-Json -Url $signupUrl -Method 'POST' -Body $BODY -Headers @{ 'X-CSRF-Token' = $TOKEN } -Session $S
"Signup response:"
$signup | Format-List * | Out-String | Write-Host

# Me
$me = Invoke-Json -Url "$Base/me" -Session $S
"Me response:"
$me | Format-List * | Out-String | Write-Host
