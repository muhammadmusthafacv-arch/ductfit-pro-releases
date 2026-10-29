param(
    [switch]$NonInteractive
)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       DUCTFIT PRO - ONE-CLICK RELEASE PUBLISHER          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify GH_TOKEN
if (-not $env:GH_TOKEN) {
    $env:GH_TOKEN = [System.Environment]::GetEnvironmentVariable('GH_TOKEN', 'User')
}
if (-not $env:GH_TOKEN) {
    Write-Host "[ERROR] GH_TOKEN environment variable is not set." -ForegroundColor Red
    Write-Host "Please set your GitHub Personal Access Token by running:" -ForegroundColor Yellow
    Write-Host "  [System.Environment]::SetEnvironmentVariable('GH_TOKEN', '<your-token>', 'User')" -ForegroundColor Yellow
    Write-Host "and restart your command prompt." -ForegroundColor Yellow
    if (-not $NonInteractive) { pause }
    exit 1
}

# 2. Check and manage version
$pkgPath = Join-Path (Get-Location) "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$currentVersion = $pkg.version

$ghHeaders = @{
    'Authorization' = "token $env:GH_TOKEN"
    'User-Agent' = 'DuctfitPro-Release-Script'
    'Accept' = 'application/vnd.github.v3+json'
}
$isAlreadyPublished = $false
try {
    $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/muhammadmusthafacv-arch/ductfit-pro-releases/releases" -Headers $ghHeaders
    if ($existing | Where-Object { $_.tag_name -eq "v$currentVersion" }) {
        $isAlreadyPublished = $true
    }
} catch {}

if ($isAlreadyPublished) {
    $parts = $currentVersion.Split('.')
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2] + 1
    $newVersion = "$major.$minor.$patch"
    $pkg.version = $newVersion
    
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($pkgPath, ($pkg | ConvertTo-Json -Depth 10), $utf8NoBom)
    python -c "import json; p='package.json'; d=json.load(open(p, 'r', encoding='utf-8-sig')); open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2))"
    python -c "import json; p='version.json'; d=json.load(open(p, 'r', encoding='utf-8-sig')); d['version']='$newVersion'; parts='$newVersion'.split('.'); d['major']=int(parts[0]); d['minor']=int(parts[1]); d['patch']=int(parts[2]); open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2))"
    Write-Host "[1/4] Bumped version: $currentVersion -> $newVersion" -ForegroundColor Green
} else {
    $newVersion = $currentVersion
    python -c "import json; p='package.json'; d=json.load(open(p, 'r', encoding='utf-8-sig')); open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2))"
    python -c "import json; p='version.json'; d=json.load(open(p, 'r', encoding='utf-8-sig')); d['version']='$newVersion'; parts='$newVersion'.split('.'); d['major']=int(parts[0]); d['minor']=int(parts[1]); d['patch']=int(parts[2]); open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2))"
    Write-Host "[1/4] Publishing version: $newVersion" -ForegroundColor Green
}

# 3. Read certificate password
$certPassFile = Join-Path (Get-Location) "signing\private\cert-password.txt"
if (-not (Test-Path $certPassFile)) {
    Write-Host "[ERROR] Signing password file not found: $certPassFile" -ForegroundColor Red
    exit 1
}
$env:CSC_KEY_PASSWORD = (Get-Content $certPassFile).Trim()

# 4. Build python backend
Write-Host "[2/4] Compiling Python backend server..." -ForegroundColor White
python -m PyInstaller ductfit-server.spec --clean -y
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] PyInstaller build failed." -ForegroundColor Red
    exit 1
}

# 5. Build, sign, and publish via electron-builder
Write-Host "[3/4] Building, signing installer and publishing to GitHub Releases..." -ForegroundColor White
npx.cmd electron-builder --win --x64 --publish always
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Electron builder packaging or publishing failed." -ForegroundColor Red
    exit 1
}

# 5b. Ensure the release is published (not left in draft)
try {
    $ghHeaders = @{
        'Authorization' = "token $env:GH_TOKEN"
        'User-Agent' = 'DuctfitPro-Release-Script'
        'Accept' = 'application/vnd.github.v3+json'
    }
    $allReleases = Invoke-RestMethod -Uri "https://api.github.com/repos/muhammadmusthafacv-arch/ductfit-pro-releases/releases" -Headers $ghHeaders
    $currentRelease = $allReleases | Where-Object { $_.tag_name -eq "v$newVersion" }
    if ($currentRelease -and $currentRelease.draft) {
        Write-Host "Publishing draft release v$newVersion..." -ForegroundColor Yellow
        $patchBody = @{ draft = $false } | ConvertTo-Json
        $null = Invoke-RestMethod -Uri "https://api.github.com/repos/muhammadmusthafacv-arch/ductfit-pro-releases/releases/$($currentRelease.id)" -Method Patch -Headers $ghHeaders -Body $patchBody -ContentType "application/json"
        Write-Host "Release v$newVersion is now live!" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARNING] Could not auto-publish draft: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 6. Copy new installer to Release-Pack & Create ZIP bundle
$builtInstaller = Join-Path (Get-Location) "dist\installer\DuctfitPro-Setup-$newVersion.exe"
if (Test-Path $builtInstaller) {
    Get-ChildItem -Path "Release-Pack" -Filter "DuctfitPro-Setup-*.exe" | Remove-Item -Force -ErrorAction SilentlyContinue
    Copy-Item $builtInstaller -Destination "Release-Pack\" -Force

    $zipPath = Join-Path (Get-Location) "dist\installer\Ductfit-Pro-v$newVersion-Setup.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Write-Host "Creating ZIP bundle: $zipPath..." -ForegroundColor White
    Compress-Archive -Path "Release-Pack\*" -DestinationPath $zipPath -Force

    # Upload ZIP to GitHub Release assets
    try {
        $rel = (Invoke-RestMethod -Uri "https://api.github.com/repos/muhammadmusthafacv-arch/ductfit-pro-releases/releases" -Headers $ghHeaders) | Where-Object { $_.tag_name -eq "v$newVersion" }
        if ($rel) {
            $uploadBase = $rel.upload_url -replace '\{\?name,label\}', ''
            $uploadUri = "$uploadBase`?name=Ductfit-Pro-v$newVersion-Setup.zip"
            Write-Host "Uploading ZIP asset to GitHub release: $uploadUri" -ForegroundColor White
            $zipBytes = [System.IO.File]::ReadAllBytes($zipPath)
            $uploadHeaders = @{
                'Authorization' = "token $env:GH_TOKEN"
                'User-Agent' = 'DuctfitPro-Release-Script'
                'Content-Type' = 'application/zip'
            }
            $null = Invoke-RestMethod -Uri $uploadUri -Method Post -Headers $uploadHeaders -Body $zipBytes
            Write-Host "ZIP asset uploaded successfully!" -ForegroundColor Green
        }
    } catch {
        Write-Host "[WARNING] Could not upload ZIP asset: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " SUCCESS! Ductfit Pro v$newVersion has been published!   " -ForegroundColor Green
Write-Host " Installers are live on GitHub Releases.                 " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
if (-not $NonInteractive) {
    pause
}
