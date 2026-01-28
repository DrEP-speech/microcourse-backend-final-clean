Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-Truthy {
  param($Value)
  if ($null -eq $Value) { return $false }
  if ($Value -is [string]) { return -not [string]::IsNullOrWhiteSpace($Value) }
  if ($Value -is [System.Collections.IDictionary]) { return $Value.Keys.Count -gt 0 }
  if ($Value -is [System.Collections.ICollection]) { return $Value.Count -gt 0 }
  return [bool]$Value
}

function Assert {
  param(
    $Cond,
    [string]$Msg = "Assertion failed."
  )
  if (-not (Test-Truthy $Cond)) { throw $Msg }
}

function Get-Prop {
  param($Obj, [string[]]$Names)
  if ($null -eq $Obj) { return $null }
  foreach ($n in $Names) {
    if ($Obj.PSObject.Properties.Name -contains $n) { return $Obj.$n }
  }
  return $null
}

function As-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [System.Array]) { return $Value }
  return @($Value)
}

function Extract-List {
  param(
    $Payload,
    [string]$PropName
  )

  if ($null -eq $Payload) { return @() }
  if ($Payload -is [System.Array]) { return $Payload }

  $direct = Get-Prop $Payload @($PropName)
  if ($null -ne $direct) { return As-Array $direct }

  $data = Get-Prop $Payload @("data","result","payload")
  if ($null -ne $data) {
    $inner = Get-Prop $data @($PropName)
    if ($null -ne $inner) { return As-Array $inner }
  }

  return @()
}

function Read-HttpErrorBody {
  param($Err)
  try {
    if ($Err.Exception.Response -and $Err.Exception.Response.GetResponseStream) {
      $sr = New-Object System.IO.StreamReader($Err.Exception.Response.GetResponseStream())
      return $sr.ReadToEnd()
    }
  } catch { }
  return $null
}

function Invoke-JsonSafe {
  param(
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST","PUT","PATCH","DELETE")] [string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers = $null,
    $Body = $null,
    [int]$TimeoutSec = 30
  )

  try {
    $p = @{
      Method      = $Method
      Uri         = $Url
      TimeoutSec  = $TimeoutSec
      ErrorAction = "Stop"
    }
    if ($Headers) { $p.Headers = $Headers }
    if ($null -ne $Body) {
      $p.ContentType = "application/json"
      $p.Body = ($Body | ConvertTo-Json -Depth 40)
    }

    $resp = Invoke-RestMethod @p
    return [pscustomobject]@{
      ok          = $true
      status      = 200
      contentType = "application/json"
      data        = $resp
      raw         = $null
      error       = $null
    }
  }
  catch {
    $status = $null
    $ct = $null
    try { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode } } catch { }
    try { if ($_.Exception.Response) { $ct = $_.Exception.Response.ContentType } } catch { }

    $raw = Read-HttpErrorBody $_
    $json = $null
    if ($raw -and $raw.Trim().StartsWith("{")) {
      try { $json = $raw | ConvertFrom-Json } catch { }
    }

    return [pscustomobject]@{
      ok          = $false
      status      = $status
      contentType = $ct
      data        = $json
      raw         = $raw
      error       = $_.Exception.Message
    }
  }
}

function Pick-FirstWorkingEndpoint {
  param(
    [Parameter(Mandatory=$true)][string[]]$Urls,
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST")] [string]$Method,
    [hashtable]$Headers = $null,
    $Body = $null
  )

  foreach ($u in $Urls) {
    $r = Invoke-JsonSafe -Method $Method -Url $u -Headers $Headers -Body $Body
    # "working" means: it returned JSON (or at least not HTML) AND not a 404
    $isHtml = $r.contentType -like "text/html*"
    if ($r.ok -or ($r.status -ne 404 -and -not $isHtml)) {
      return [pscustomobject]@{ url = $u; res = $r }
    }
  }

  return $null
}

function Get-TokenFromArtifacts {
  param(
    [Parameter(Mandatory=$true)]$Artifacts,
    [Parameter(Mandatory=$true)][string[]]$RoleKeys
  )

  foreach ($rk in $RoleKeys) {
    $node = Get-Prop $Artifacts @($rk)
    if ($node) {
      $tok = Get-Prop $node @("token","jwt","accessToken")
      if (Test-Truthy $tok) { return $tok }
    }
  }
  return $null
}

function Get-IdFromObject {
  param($Obj)
  if ($null -eq $Obj) { return $null }
  $id = Get-Prop $Obj @("id","_id","courseId","quizId")
  if (Test-Truthy $id) { return [string]$id }
  return $null
}
