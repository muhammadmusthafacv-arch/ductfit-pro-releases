param(
    [string]$CommitMessage = "chore(sync): update web build from desktop app"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       DUCTFIT PRO - WEB REPOSITORY SYNCHRONIZER          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$src = "F:\MUSTHAFA\CHD\DUCT SIZER APP"
$dst = "F:\MUSTHAFA\CHD\DUCT SIZER WEB"

if (-not (Test-Path $dst)) {
    Write-Host "[ERROR] Web repository directory not found: $dst" -ForegroundColor Red
    exit 1
}

# 1. Synchronize core source files to web duplicate
Write-Host "[1/3] Copying updated files to web directory..." -ForegroundColor White
$filesToSync = @(
    "app.py",
    "ashrae_engine.py",
    "ashrae_official_runner.py",
    "pdf_report_generator.py",
    "pdf_master_catalog.py",
    "project_manager.py",
    "version_manager.py",
    "version.json",
    "fittings_tree.json",
    "custom_templates.json"
)

foreach ($f in $filesToSync) {
    $srcFile = Join-Path $src $f
    $dstFile = Join-Path $dst $f
    if (Test-Path $srcFile) {
        Copy-Item $srcFile -Destination $dstFile -Force
    }
}

# Sync templates and static
Copy-Item (Join-Path $src "templates\*") -Destination (Join-Path $dst "templates\") -Recurse -Force
Copy-Item (Join-Path $src "static\*") -Destination (Join-Path $dst "static\") -Recurse -Force
Copy-Item (Join-Path $src "ashrae_data\*") -Destination (Join-Path $dst "ashrae_data\") -Recurse -Force

# Re-render root index.html
$srcHtml = Join-Path $dst "templates\index.html"
$dstHtml = Join-Path $dst "index.html"
$ver = (Get-Content (Join-Path $dst "version.json") -Raw | ConvertFrom-Json).version
$htmlContent = (Get-Content $srcHtml -Raw).Replace("{{ version|default('1.0.5') }}", $ver)
[System.IO.File]::WriteAllText($dstHtml, $htmlContent, (New-Object System.Text.UTF8Encoding($false)))

# 2. Commit in web duplicate
Write-Host "[2/3] Committing changes in web repository..." -ForegroundColor White
Push-Location $dst
try {
    git add -A
    $status = git status --porcelain
    if ($status) {
        git commit -m $CommitMessage
        Write-Host "Committed: $CommitMessage" -ForegroundColor Green
    } else {
        Write-Host "No changes detected in web repository." -ForegroundColor Yellow
    }

    # 3. Push to GitHub
    Write-Host "[3/3] Pushing to GitHub (muhammadmusthafacv-arch/ductfit-pro-web)..." -ForegroundColor White
    git push origin main
    Write-Host "Web repository synchronized on GitHub! Netlify will auto-deploy." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " SUCCESS! Localhost, Windows App, and Web are in sync!   " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
