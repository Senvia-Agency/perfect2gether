[CmdletBinding()]
param(
    [int]$DockerWaitSeconds = 90,
    [switch]$NoDockerStart
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'common.ps1')

$paths = Ensure-LocalLayout
Assert-LocalEndpoint -Url 'http://127.0.0.1:54321' -ProjectId (Get-LocalProjectId) | Out-Null

if (-not (Test-DockerReady)) {
    if (-not $NoDockerStart) {
        [void](Start-DockerDesktopHidden)
    }
    if (-not (Wait-DockerReady -TimeoutSeconds $DockerWaitSeconds)) {
        throw "Docker daemon unavailable after ${DockerWaitSeconds}s. Expected npipe:////./pipe/dockerDesktopLinuxEngine; no Supabase or remote command was attempted."
    }
}

$supabase = Get-SupabaseInvocation
Invoke-SupabaseLocal -Invocation $supabase -Arguments @('start') | Out-Host
$status = Get-LocalStatusEnvironment -Invocation $supabase
$envPath = Write-LocalEnvFile -Status $status

Write-Output "EDP_LOCAL_READY api=$($status.ApiUrl) studio=http://127.0.0.1:54323 inbucket=http://127.0.0.1:54324 env=$envPath"
