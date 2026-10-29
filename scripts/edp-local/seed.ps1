$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'common.ps1')

Ensure-LocalLayout | Out-Null
Assert-LocalEndpoint -Url 'http://127.0.0.1:54321' -ProjectId (Get-LocalProjectId) | Out-Null
if (-not (Test-DockerReady)) {
    throw 'Docker daemon is not available; local seed reset was not attempted.'
}

$supabase = Get-SupabaseInvocation
Invoke-SupabaseLocal -Invocation $supabase -Arguments @('db', 'reset', '--local', '--yes') | Out-Host
$status = Get-LocalStatusEnvironment -Invocation $supabase
$envPath = Write-LocalEnvFile -Status $status
Write-Output "EDP_LOCAL_SEEDED env=$envPath"
