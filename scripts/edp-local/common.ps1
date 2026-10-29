Set-StrictMode -Version Latest

$script:LocalProjectId = 'p2g-edp-local'
$script:ProductionProjectId = 'zycrksvkdpondqpplqce'

function Get-LocalProjectId {
    return $script:LocalProjectId
}

function Get-LocalPaths {
    $localRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
    $repoRoot = (Resolve-Path -LiteralPath (Join-Path $localRoot '..\..')).Path

    return [pscustomobject]@{
        LocalRoot = $localRoot
        RepoRoot = $repoRoot
        LocalSupabaseRoot = (Join-Path $localRoot 'supabase')
        Config = (Join-Path $localRoot 'supabase\config.toml')
        EnvFile = (Join-Path $localRoot '.env.local')
        SourceMigrations = (Join-Path $repoRoot 'supabase\migrations')
        SourceFunctions = (Join-Path $repoRoot 'supabase\functions')
        LocalMigrations = (Join-Path $localRoot 'supabase\migrations')
        LocalFunctions = (Join-Path $localRoot 'supabase\functions')
    }
}

function Assert-LocalEndpoint {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,

        [Parameter(Mandatory = $true)]
        [string]$ProjectId
    )

    if ($ProjectId -ne $script:LocalProjectId) {
        throw "Local-only guard rejected project id '$ProjectId'. Expected '$($script:LocalProjectId)'."
    }

    if ($Url -match [regex]::Escape($script:ProductionProjectId) -or $Url -match '(?i)\.supabase\.co') {
        throw "Local-only guard rejected a hosted Supabase URL. Production and hosted URLs are forbidden."
    }

    try {
        $uri = [Uri]::new($Url)
    } catch {
        throw "Local-only guard rejected malformed URL '$Url'."
    }

    $loopbackHosts = @('localhost', '127.0.0.1', '::1')
    if ($uri.Scheme -ne 'http' -or $loopbackHosts -notcontains $uri.Host) {
        throw "Local-only guard requires an http loopback URL; received '$Url'."
    }

    if ($uri.UserInfo -or $uri.Query -or $uri.Fragment) {
        throw "Local-only guard rejected credentials, query text, or fragments in URL '$Url'."
    }

    Write-Output "LOCAL_ONLY_OK url=$Url project_id=$ProjectId"
}

function Ensure-LocalMirror {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$MirrorPath,

        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    if (-not (Test-Path -LiteralPath $TargetPath -PathType Container)) {
        throw "Local source directory is missing: $TargetPath"
    }

    if (-not (Test-Path -LiteralPath $MirrorPath -PathType Container)) {
        New-Item -ItemType Directory -Path $MirrorPath | Out-Null
    }

    foreach ($sourceItem in Get-ChildItem -LiteralPath $TargetPath -Force) {
        Copy-Item -LiteralPath $sourceItem.FullName -Destination $MirrorPath -Recurse -Force
    }
}

function Ensure-LocalLayout {
    $paths = Get-LocalPaths
    if (-not (Test-Path -LiteralPath $paths.LocalSupabaseRoot -PathType Container)) {
        New-Item -ItemType Directory -Path $paths.LocalSupabaseRoot | Out-Null
    }

    Ensure-LocalMirror -MirrorPath $paths.LocalMigrations -TargetPath $paths.SourceMigrations
    Ensure-LocalMirror -MirrorPath $paths.LocalFunctions -TargetPath $paths.SourceFunctions
    return $paths
}

function Get-SupabaseInvocation {
    $native = Get-Command supabase.exe -ErrorAction SilentlyContinue
    if (-not $native) {
        $native = Get-Command supabase -ErrorAction SilentlyContinue
    }

    if ($native) {
        return [pscustomobject]@{
            Executable = $native.Source
            Prefix = @()
        }
    }

    $npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $npx) {
        $npx = Get-Command npx -ErrorAction SilentlyContinue
    }

    if ($npx) {
        return [pscustomobject]@{
            Executable = $npx.Source
            Prefix = @('--yes', 'supabase')
        }
    }

    throw 'Supabase CLI was not found. Install it locally or make npx available; no remote command was attempted.'
}

function Invoke-SupabaseLocal {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [pscustomobject]$Invocation,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $paths = Get-LocalPaths
    $commandArguments = @($Invocation.Prefix) + @($Arguments)
    Push-Location -LiteralPath $paths.LocalRoot
    try {
        $output = & $Invocation.Executable @commandArguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    $output | Write-Output
    if ($exitCode -ne 0) {
        throw "Supabase local command failed with exit code ${exitCode}: $($Arguments -join ' ')"
    }

    return $output
}

function Invoke-ProcessBounded {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [int]$TimeoutMilliseconds
    )

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    foreach ($argument in $Arguments) {
        [void]$startInfo.ArgumentList.Add($argument)
    }

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    [void]$process.Start()
    if (-not $process.WaitForExit($TimeoutMilliseconds)) {
        try {
            $process.Kill($true)
        } catch {
            # The bounded process has already timed out; preserve the timeout result.
        }
        return [pscustomobject]@{ ExitCode = 124; Stdout = ''; Stderr = 'process timed out' }
    }

    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        Stdout = $process.StandardOutput.ReadToEnd()
        Stderr = $process.StandardError.ReadToEnd()
    }
}

function Test-DockerReady {
    $docker = Get-Command docker.exe -ErrorAction SilentlyContinue
    if (-not $docker) {
        $docker = Get-Command docker -ErrorAction SilentlyContinue
    }
    if (-not $docker) {
        return $false
    }

    $result = Invoke-ProcessBounded -FilePath $docker.Source -Arguments @('info', '--format', '{{.ServerVersion}}') -TimeoutMilliseconds 5000
    return $result.ExitCode -eq 0
}

function Start-DockerDesktopHidden {
    if (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue) {
        return $true
    }

    $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (-not (Test-Path -LiteralPath $desktop -PathType Leaf)) {
        return $false
    }

    Start-Process -FilePath $desktop -WindowStyle Hidden | Out-Null
    return $true
}

function Wait-DockerReady {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-DockerReady) {
            return $true
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Get-LocalStatusEnvironment {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][pscustomobject]$Invocation)

    $output = @(Invoke-SupabaseLocal -Invocation $Invocation -Arguments @('status', '--output', 'env'))
    $values = @{}
    foreach ($line in $output) {
        if ($line -match '^([A-Z0-9_]+)=(.*)$') {
            $values[$Matches[1]] = $Matches[2].Trim().Trim('"')
        }
    }

    $apiUrl = $values['API_URL']
    $anonKey = $values['ANON_KEY']
    $serviceRoleKey = $values['SERVICE_ROLE_KEY']
    if (-not $apiUrl -or -not $anonKey -or -not $serviceRoleKey) {
        throw 'Supabase status did not return API_URL, ANON_KEY, and SERVICE_ROLE_KEY; refusing to write app configuration.'
    }

    Assert-LocalEndpoint -Url $apiUrl -ProjectId $script:LocalProjectId | Out-Null
    return [pscustomobject]@{
        ApiUrl = $apiUrl
        AnonKey = $anonKey
        ServiceRoleKey = $serviceRoleKey
    }
}

function Write-LocalEnvFile {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][pscustomobject]$Status)

    $paths = Get-LocalPaths
    $contents = @(
        "VITE_SUPABASE_URL=$($Status.ApiUrl)",
        "VITE_SUPABASE_PUBLISHABLE_KEY=$($Status.AnonKey)",
        "VITE_SUPABASE_PROJECT_ID=$script:LocalProjectId",
        "SUPABASE_URL=$($Status.ApiUrl)",
        "SUPABASE_ANON_KEY=$($Status.AnonKey)",
        "SUPABASE_PUBLISHABLE_KEY=$($Status.AnonKey)",
        "SUPABASE_SERVICE_ROLE_KEY=$($Status.ServiceRoleKey)",
        'EDP_LOCAL_SMTP_HOST=127.0.0.1',
        'EDP_LOCAL_SMTP_PORT=54325',
        'EDP_LOCAL_INBUCKET_URL=http://127.0.0.1:54324'
    ) -join [Environment]::NewLine
    [IO.File]::WriteAllText($paths.EnvFile, $contents + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    return $paths.EnvFile
}

function Read-LocalEnvFile {
    $paths = Get-LocalPaths
    if (-not (Test-Path -LiteralPath $paths.EnvFile -PathType Leaf)) {
        throw "Local environment file is missing: $($paths.EnvFile). Run start.ps1 first."
    }

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $paths.EnvFile) {
        if ($line -match '^([A-Z0-9_]+)=(.*)$') {
            $values[$Matches[1]] = $Matches[2]
        }
    }
    if (-not $values['VITE_SUPABASE_URL'] -or -not $values['VITE_SUPABASE_PUBLISHABLE_KEY']) {
        throw 'Local environment file is missing the VITE Supabase URL or anon key.'
    }

    Assert-LocalEndpoint -Url $values['VITE_SUPABASE_URL'] -ProjectId $script:LocalProjectId | Out-Null
    return $values
}
