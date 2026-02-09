# scripts/Invoke-Api.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST","PUT","PATCH","DELETE")]
    [string]$Method,

    [Parameter(Mandatory=$true)][string]$Url,

    [Parameter(Mandatory=$false)]
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session = $null,

    [Parameter(Mandatory=$false)]
    [string]$Token = $null,

    [Parameter(Mandatory=$false)]
    $Body = $null,

    [Parameter(Mandatory=$false)]
    [switch]$AllowNon2xx
  )

  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }

  $req = @{
    Method     = $Method
    Uri        = $Url
    TimeoutSec = 30
    Headers    = $headers
  }
  if ($Session) { $req["WebSession"] = $Session }

  # If we claim JSON, we must send a JSON STRING.
  if ($null -ne $Body) {
    $req["ContentType"] = "application/json"
    $req["Body"] = ($Body | ConvertTo-Json -Depth 30)
  }

  try {
    return Invoke-RestMethod @req
  } catch {
    if (-not $AllowNon2xx) { throw }

    # Best-effort: extract response body from multiple exception shapes.
    $ex = $_.Exception
    $raw = $null

    # Shape A: WebException/HttpWebResponse (.Response)
    if ($ex -and ($ex.PSObject.Properties.Name -contains "Response") -and $ex.Response) {
      try {
        $stream = $ex.Response.GetResponseStream()
        if ($stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $raw = $reader.ReadToEnd()
        }
      } catch {}
    }

    # Shape B: PowerShell 7 HttpResponseMessage (.Response / .Message may vary)
    if (-not $raw -and $ex -and ($ex.PSObject.Properties.Name -contains "ErrorDetails") -and $ex.ErrorDetails) {
      try { $raw = $ex.ErrorDetails.Message } catch {}
    }

    if ($raw) {
      try { return ($raw | ConvertFrom-Json) } catch { return @{ ok=$false; error="HTTP_ERROR"; raw=$raw } }
    }

    return @{ ok=$false; error="HTTP_ERROR"; message=$ex.Message }
  }
}
