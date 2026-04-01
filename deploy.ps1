param(
    [string]$GroqApiKey
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$inventoryPath = Join-Path $repoRoot "inventory.ini"
$playbookPath = Join-Path $repoRoot "deploy.yml"

if (-not (Get-Command ansible-playbook -ErrorAction SilentlyContinue)) {
    throw "ansible-playbook is not installed or not available on PATH."
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
