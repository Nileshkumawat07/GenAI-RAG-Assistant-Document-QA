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

$env:GROQ_API_KEY = $GroqApiKey

Write-Host "Deploying application with inventory.ini and deploy.yml..."
ansible-playbook -i $inventoryPath $playbookPath
