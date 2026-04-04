param(
    [string]$GroqApiKey
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$inventoryPath = Join-Path $repoRoot "inventory.ini"
$playbookPath = Join-Path $repoRoot "deploy.yml"
$backendEnvPath = Join-Path $repoRoot "backend\.env"

if (-not (Get-Command ansible-playbook -ErrorAction SilentlyContinue)) {
    throw "ansible-playbook is not installed or not available on PATH."
}

if (-not $GroqApiKey) {
    if (Test-Path $backendEnvPath) {
        $envLines = Get-Content $backendEnvPath
        $keyLine = $envLines | Where-Object { $_ -match '^GROQ_API_KEY=' } | Select-Object -First 1
        if ($keyLine) {
            $GroqApiKey = ($keyLine -replace '^GROQ_API_KEY=', '').Trim()
        }
    }
}

if (-not $GroqApiKey) {
    $secureKey = Read-Host "Enter GROQ_API_KEY" -AsSecureString
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    try {
        $GroqApiKey = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

if ([string]::IsNullOrWhiteSpace($GroqApiKey)) {
    throw "GROQ_API_KEY cannot be empty."
}

$requiredEnvKeys = @(
    "FRONTEND_ORIGIN"
)

if (Test-Path $backendEnvPath) {
    foreach ($line in Get-Content $backendEnvPath) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
            continue
        }

        $parts = $line -split "=", 2
        if ($parts.Count -ne 2) {
            continue
        }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if ($key) {
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$env:GROQ_API_KEY = $GroqApiKey

foreach ($key in $requiredEnvKeys) {
    if ([string]::IsNullOrWhiteSpace([System.Environment]::GetEnvironmentVariable($key, "Process"))) {
        throw "$key is missing. Add it to backend/.env before deploying."
    }
}

Write-Host "Deploying application with inventory.ini and deploy.yml..."
ansible-playbook -i $inventoryPath $playbookPath
