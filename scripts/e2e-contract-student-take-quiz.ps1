Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_lib.ps1"

Write-Section "E2E + Contract Verify"
& "$PSScriptRoot\contract-verify.ps1"