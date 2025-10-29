param([int[]]$Ports = @(10003,10005))

$here = $PSScriptRoot
if (-not $here) { $here = Split-Path -Parent $MyInvocation.MyCommand.Path }

foreach ($p in $Ports) {
  & "$here\free-port.ps1" -Port $p
}
