$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'common.ps1')

$paths = Get-LocalPaths
$values = Read-LocalEnvFile
Assert-LocalEndpoint -Url $values['VITE_SUPABASE_URL'] -ProjectId (Get-LocalProjectId) | Out-Null

$env:VITE_SUPABASE_URL = $values['VITE_SUPABASE_URL']
$env:VITE_SUPABASE_PUBLISHABLE_KEY = $values['VITE_SUPABASE_PUBLISHABLE_KEY']
$env:VITE_SUPABASE_PROJECT_ID = $values['VITE_SUPABASE_PROJECT_ID']
$env:SUPABASE_URL = $values['SUPABASE_URL']
$env:SUPABASE_ANON_KEY = $values['SUPABASE_ANON_KEY']
$env:SUPABASE_PUBLISHABLE_KEY = $values['SUPABASE_PUBLISHABLE_KEY']
$env:EDP_LOCAL_SMTP_HOST = $values['EDP_LOCAL_SMTP_HOST']
$env:EDP_LOCAL_SMTP_PORT = $values['EDP_LOCAL_SMTP_PORT']
$env:EDP_LOCAL_INBUCKET_URL = $values['EDP_LOCAL_INBUCKET_URL']

Push-Location -LiteralPath $paths.RepoRoot
try {
    npm run dev -- --host 127.0.0.1 --port 8080
} finally {
    Pop-Location
}
