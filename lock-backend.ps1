param(
  [int]$Port = 4000,
  [switch]$NoStart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Fail($m){ Write-Host $m -ForegroundColor Red; exit 1 }

function Load-DotEnv([string]$Path){
  if(!(Test-Path $Path)){ Fail "Missing .env file at: $Path" }
  $raw = Get-Content $Path
  foreach($line in $raw){
    $t = $line.Trim()
    if(!$t -or $t.StartsWith("#")){ continue }

    # If someone put the mongo uri as a raw first line, convert it
    if($t -notmatch "^\s*[A-Za-z_]\w*\s*=" -and $t -like "mongodb*"){
      $name="MONGO_URI"; $val=$t
    } else {
      $parts = $t.Split("=",2)
      if($parts.Count -ne 2){ continue }
      $name = $parts[0].Trim()
      $val  = $parts[1].Trim()
    }

    # strip surrounding quotes
    if(($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))){
      $val = $val.Substring(1, $val.Length-2)
    }

    [Environment]::SetEnvironmentVariable($name, $val, "Process")
  }
}

function Assert-Env([string[]]$Keys){
  $missing = @()
  foreach($k in $Keys){
    $v = [Environment]::GetEnvironmentVariable($k,"Process")
    if([string]::IsNullOrWhiteSpace($v)){ $missing += $k; continue }
    if($k -eq "MONGO_URI"){
      if($v -match "<db_password>" -or $v -match "CLUSTER\.mongodb\.net"){ $missing += "$k (placeholder)"; continue }
    }
  }
  if($missing.Count -gt 0){
    Fail ("Missing/invalid env: " + ($missing -join ", ") + "`nFix .env then re-run.")
  }
}

function Kill-Port([int]$P){
  $conns = Get-NetTCPConnection -LocalPort $P -ErrorAction SilentlyContinue
  if(!$conns){ Ok "[OK] Nothing using port $P"; return }
  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach($pid in $pids){
    try { Stop-Process -Id $pid -Force -ErrorAction Stop; Warn "[KILLED] PID $pid on port $P" }
    catch { Warn "[WARN] Could not kill PID ${pid}: $($_.Exception.Message)" }
  }
}

Info "=== LOCK backend pack running ==="
Load-DotEnv ".\.env"

# Port precedence: script param -> env PORT -> default
$envPort = [Environment]::GetEnvironmentVariable("PORT","Process")
if($envPort -and ($Port -eq 4000)){ 
  [int]$Port = $envPort 
}
[Environment]::SetEnvironmentVariable("PORT", "$Port", "Process")

Assert-Env @("MONGO_URI","JWT_SECRET")
Ok "[ENV] OK. PORT=$Port"

Kill-Port $Port

if($NoStart){
  Warn "[NOTE] -NoStart set. Not starting server."
  exit 0
}

Info "[RUN] npm run dev"
npm run dev

