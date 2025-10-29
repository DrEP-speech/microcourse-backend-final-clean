#Requires -Version 7
Set-StrictMode -Version Latest
function Invoke-WithRetry {
  [CmdletBinding(SupportsShouldProcess)]
  param(
    [Parameter(Mandatory)][string]$Url,
    [ValidateSet('GET','POST','PUT','PATCH','DELETE')][string]$Method = 'GET',
    [hashtable]$Headers,
    [object]$Body,
    [int]$MaxRetries = 5,
    [int]$DelaySeconds = 2,
    [int]$TimeoutSec = 30
  )
  $attempt = 0
  do {
    try {
      $attempt++
      $p = @{ Uri=$Url; Method=$Method; TimeoutSec=$TimeoutSec; ErrorAction='Stop' }
      if ($Headers) { $p.Headers = $Headers }
      if ($PSBoundParameters.ContainsKey('Body')) {
        $p.ContentType = 'application/json'
        $p.Body = ($Body -is [string]) ? $Body : (ConvertTo-Json $Body -Depth 10)
      }
      return Invoke-RestMethod @p
    } catch {
      if ($attempt -ge $MaxRetries) { throw }
      Start-Sleep -Seconds ([math]::Min($DelaySeconds * [math]::Pow(2, $attempt-1), 30))
    }
  } while ($true)
}