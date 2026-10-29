$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'common.ps1')

Ensure-LocalLayout | Out-Null
Assert-LocalEndpoint -Url 'http://127.0.0.1:54321' -ProjectId (Get-LocalProjectId) | Out-Null
if (-not (Test-DockerReady)) {
    Write-Output 'EDP_LOCAL_STOPPED docker=not-running'
    exit 0
}

$supabase = Get-SupabaseInvocation
Invoke-SupabaseLocal -Invocation $supabase -Arguments @('stop', '--no-backup') | Out-Host
Write-Output 'EDP_LOCAL_STOPPED docker=ready'
