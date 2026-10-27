# Ductfit Pro — Maintainer Guide

This guide is written for you in simple, plain English. Keep it safe.

---

## 1. How to Publish a New Version (One-Click)

Whenever you make improvements or changes to Ductfit Pro and want all computers to update:

1. Double-click **`release.bat`** in the project folder.
2. That is all! The script automatically:
   - Increases the version number (e.g. `1.0.0` &rarr; `1.0.1`).
   - Packages the Python backend engine.
   - Signs the installer with your organisation's security certificate.
   - Uploads and publishes the update to your GitHub releases repository.
3. Within a few hours (or the next time staff open the app), Ductfit Pro will download the update silently in the background and install it when they close the app.

---

## 2. Where the Signing Certificate Is (CRITICAL BACKUP)

Your security certificate is located in:
```
F:\MUSTHAFA\CHD\DUCT SIZER APP\signing\private\
  ├── DuctfitPro-Signing.pfx    (The private signing certificate)
  └── cert-password.txt         (The password that protects it)
```

> **IMPORTANT:**
> - **Make a backup copy of this folder** onto a secure USB drive right now.
> - Windows uses this certificate to verify that updates come from you.
> - If you lose this file, future updates will not install over existing installations.
> - **Never share this folder or upload it to GitHub.** It is protected by `.gitignore`.

---

## 3. How to Set Up a New Computer as the Maintainer

If you ever move your development work to a new computer:

1. Copy the project folder `F:\MUSTHAFA\CHD\DUCT SIZER APP` to the new computer.
2. Install **Node.js LTS** from [https://nodejs.org](https://nodejs.org).
3. Install **Python 3** and run:
   ```cmd
   pip install flask numpy Pillow reportlab pyinstaller
   ```
4. Run in the project folder:
   ```cmd
   npm install
   ```
5. Set your GitHub token environment variable:
   ```powershell
   [System.Environment]::SetEnvironmentVariable('GH_TOKEN', '<your-token>', 'User')
   ```
6. You are ready to build or publish using `release.bat`.

---

## 4. How to Renew the Certificate in 10 Years (Year 2036)

Your certificate is valid for **10 full years** (until **October 25, 2036**). When it expires in 2036:

1. Run the script:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scratch/generate_cert.ps1
   ```
2. Rebuild the app using `release.bat`.
3. Distribute the new `DuctSizer-Trust-Certificate.cer` and run `Install-Trust.bat` on staff PCs.

---

## 5. Troubleshooting: What if an Update Does Not Arrive?

If a computer did not receive an update:

1. **Check Internet Connection:** The computer needs internet access to reach GitHub Releases (`github.com`).
2. **Check the Update Log:**
   Ductfit Pro writes a detailed log file at:
   `%APPDATA%\Ductfit Pro\logs\main.log`
   Open this file in Notepad to see why the update was skipped (e.g. offline, or version is already up to date).
3. **Manual Update Fallback:**
   You can always copy the new setup file from `Release-Pack\DuctfitPro-Setup-<version>.exe` onto a USB drive and double-click it. It will upgrade the app in place without touching user project data.

---

## 6. Summary of Key Files

| File / Folder | Purpose |
| :--- | :--- |
| `release.bat` | Double-click to build, sign, and publish updates. |
| `Release-Pack/` | The complete package to give to staff for initial installations. |
| `signing/private/` | Your private signing certificate. Keep backed up and private! |
| `app.py` | The engineering calculation backend. |
| `electron/main.js` | The desktop window and offline launcher. |
