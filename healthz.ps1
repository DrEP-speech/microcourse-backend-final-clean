$ErrorActionPreference = 'SilentlyContinue'
$ports = @( $env:PORT, 5001, 5000 ) | Where-Object { $_ } | Select-Object -Unique
foreach ($p in $ports) {
  try {
    $r = Invoke-RestMethod "http://localhost:$p/healthz" -TimeoutSec 2
    if ($r.ok -eq $true) { Write-Host "$p : alive" } else { Write-Host "$p : responds, ok=$($r.ok)" }
  } catch {
    Write-Host "$p : down"
  }
}
