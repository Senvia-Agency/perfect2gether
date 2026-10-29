[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Url,

    [Parameter(Mandatory = $true)]
    [string]$ProjectId
)

Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'common.ps1')

Assert-LocalEndpoint -Url $Url -ProjectId $ProjectId
