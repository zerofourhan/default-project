#!/usr/bin/env pwsh
# Development environment setup script

Write-Host "=== Setting up development environment ===" -ForegroundColor Cyan

# Check tools
$tools = @("git", "python", "node", "npm", "gh")
foreach ($tool in $tools) {
    $ver = & $tool --version 2>&1 | Select-Object -First 1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] $tool : $ver" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $tool" -ForegroundColor Red
    }
}

# Python venv
if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
}

# Node modules
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
    npm install
}

# Python deps
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
. .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

Write-Host "`n=== Setup complete ===" -ForegroundColor Green
