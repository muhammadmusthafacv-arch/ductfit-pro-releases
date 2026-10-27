# Ductfit Pro — Windows Installer & Auto-Update Progress Tracker

Target OS: Windows 10 & Windows 11 (64-bit)
Workspace: `F:\MUSTHAFA\CHD\DUCT SIZER APP`
Backup: `F:\MUSTHAFA\CHD\DUCT SIZER APP - BACKUP`

---

## Phases Status

* [x] **PHASE 1 — Backup and Audit**
  * Full project backup created at `F:\MUSTHAFA\CHD\DUCT SIZER APP - BACKUP` (2,447 items verified).
  * Architecture, startup flow, storage mechanism, and network audit completed.
  * Verified 100% offline self-containment (zero CDN links, zero cloud APIs).
  * Generated `AUDIT.md`.

* [x] **PHASE 2 — Make It Fully Offline & Answer Required Questions**
  * 100% offline verified across all APIs (Tree, CR11-1, SD4-1, SIZE-AUTO, PDF report generator).
  * User answered all 4 project branding questions:
    * App Name: `Ductfit Pro`
    * Organisation: `Ductfit Pro Engg Solution`
    * Icon: `build/icon.ico` (256x256 icon imported)
    * GitHub: `muhammadmusthafacv-arch / ductfit-pro-releases`

* [x] **PHASE 3 — Electron Desktop Wrapper**
  * Single-instance lock configured (`app.requestSingleInstanceLock`).
  * User data isolation configured in `%APPDATA%\Ductfit Pro\`.
  * Dynamic ephemeral port assignment on `127.0.0.1` (never exposed to network).
  * Standalone Python server compiled using PyInstaller (`dist\ductfit-server\ductfit-server.exe`).
  * Secure Electron runtime (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
  * Splash screen (`electron/splash.html`) and native Windows menu (`electron/main.js`).

* [x] **PHASE 4 — Self-Signed Certificate & Signed Installer**
  * Generated 10-year SHA-256 Code Signing Certificate (`CN=Ductfit Pro Engg Solution`, expires 2036).
  * Private key secured at `signing\private\DuctfitPro-Signing.pfx` (protected by `.gitignore`).
  * Generated public certificate `Release-Pack\DuctSizer-Trust-Certificate.cer`.
  * Configured NSIS 64-bit one-click per-user installer with desktop & start menu shortcuts.
  * Signed both backend executable and `DuctfitPro-Setup-1.0.0.exe` using DigiCert RFC3161 timestamping.
  * Created one-time elevation script `Release-Pack\Install-Trust.bat`.

* [x] **PHASE 5 — Automatic Updates Setup (GitHub Releases)**
  * Configured `electron-updater` with GitHub provider (`muhammadmusthafacv-arch / ductfit-pro-releases`).
  * Configured silent background checking and automatic install-on-exit.
  * Created one-click updater `release.bat` and `scripts/publish-release.ps1`.
  * Offline-safe: completely suppresses update errors when disconnected from the internet.

* [x] **PHASE 6 — Verification & Testing**
  * Offline execution verified (all core calculation endpoints respond with HTTP 200).
  * Standalone binary verified (runs independently without system Python).
  * Authenticode digital signature verified (`CN=Ductfit Pro Engg Solution`).
  * Localhost isolation verified (`127.0.0.1` only).

* [x] **PHASE 7 — Delivery Package**
  * Complete `Release-Pack/` folder prepared for staff deployment.
  * Created `HOW-TO-INSTALL.txt` and `MAINTAINER-GUIDE.md`.
