$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'common.ps1')

Ensure-LocalLayout | Out-Null
Assert-LocalEndpoint -Url 'http://127.0.0.1:54321' -ProjectId (Get-LocalProjectId) | Out-Null
$supabase = Get-SupabaseInvocation
if (-not (Test-DockerReady)) {
    throw 'Docker daemon is not available; status was not queried from any remote target.'
}

$status = Get-LocalStatusEnvironment -Invocation $supabase
Write-Output "EDP_LOCAL_STATUS api=$($status.ApiUrl) studio=http://127.0.0.1:54323 inbucket=http://127.0.0.1:54324 smtp=127.0.0.1:54325"
