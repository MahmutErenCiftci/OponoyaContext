$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
$taskRuntime = Join-Path $taskProject '.local/runtime'
if (-not (Test-Path -LiteralPath (Join-Path $taskRuntime 'pnpm.cmd'))) {
    throw 'Local runtime is missing. Install the Node and pnpm versions listed in README.md and use pnpm directly.'
}
$taskOriginalPath = $env:PATH
try {
    $env:PATH = $taskRuntime + [System.IO.Path]::PathSeparator + $env:PATH
    Push-Location $taskProject
    try { & (Join-Path $taskRuntime 'pnpm.cmd') @args }
    finally { Pop-Location }
    exit $LASTEXITCODE
} finally {
    $env:PATH = $taskOriginalPath
}
