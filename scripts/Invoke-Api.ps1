Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ErrorBodyText($err) {
  try {
    $resp = $err.Exception.Response
    if ($null -eq $resp) { return $null }

    if ($resp -is [System.Net.Http.HttpResponseMessage]) {
      try { return $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch { return $null }
    }

    if ($resp -is [System.Net.WebResponse]) {
      try {
        $stream = $resp.GetResponseStream()
        if ($null -eq $stream) { return $null }
        $reader = New-Object System.IO.StreamReader($stream)
        $text = $reader.ReadToEnd()
        $reader.Dispose()
        return $text
      } catch { return $null }
    }

    return $null
  } catch {
    return $null
  }
}

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST","PUT","DELETE","PATCH")][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = @{},
    [string]$JsonBody = $null,
    [int]$TimeoutSec = 30
  )

  try {
    $params = @{
      Method      = $Method
      Uri         = $Url
      Headers     = $Headers
      TimeoutSec  = $TimeoutSec
    }

    if ($JsonBody) {
      $params["ContentType"] = "application/json"
      $params["Body"] = $JsonBody
    }

    return Invoke-RestMethod @params
  } catch {
    $status = $null
    try { $status = $_.Exception.Response.StatusCode.value__ } catch { }
    $bodyText = Get-ErrorBodyText $_
    $msg = "HTTP failure calling $Method $Url"
    if ($status) { $msg += " (status $status)" }
    if ($bodyText) { $msg += "
$bodyText" }
    throw $msg
  }
}