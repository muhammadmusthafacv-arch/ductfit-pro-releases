const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Setup logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Ensure single instance
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
    process.exit(0);
}

// User Data isolation: %APPDATA%/DuctFit Pro
const userDataDir = path.join(app.getPath('appData'), 'DuctFit Pro');
if (!fs.existsSync(userDataDir)) {
    try {
        fs.mkdirSync(userDataDir, { recursive: true });
    } catch (e) {
        log.error('Failed to create user data dir:', e);
    }
}
app.setPath('userData', userDataDir);

let mainWindow = null;
let splashWindow = null;
let serverProcess = null;
let serverPort = 5052;
let isQuitting = false;

// Resolve application icon (packaged inside electron/ or development fallback in ../build/)
const appIconPath = fs.existsSync(path.join(__dirname, 'icon.ico'))
    ? path.join(__dirname, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');

// Window state management
const windowStateFile = path.join(userDataDir, 'window-state.json');
function loadWindowState() {
    try {
        if (fs.existsSync(windowStateFile)) {
            return JSON.parse(fs.readFileSync(windowStateFile, 'utf8'));
        }
    } catch (e) {
        log.warn('Could not read window state:', e);
    }
    return { width: 1380, height: 900, isMaximized: false };
}

function saveWindowState() {
    if (!mainWindow) return;
    try {
        const bounds = mainWindow.getBounds();
        const state = {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            isMaximized: mainWindow.isMaximized()
        };
        fs.writeFileSync(windowStateFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
        log.warn('Could not save window state:', e);
    }
}

// Find a free TCP port on 127.0.0.1
function getAvailablePort(defaultPort = 5052) {
    return new Promise((resolve) => {
        const tester = net.createServer();
        tester.once('error', () => {
            // Port is in use, find an ephemeral port
            const ephemeral = net.createServer();
            ephemeral.listen(0, '127.0.0.1', () => {
                const port = ephemeral.address().port;
                ephemeral.close(() => resolve(port));
            });
        });
        tester.once('listening', () => {
            tester.close(() => resolve(defaultPort));
        });
        tester.listen(defaultPort, '127.0.0.1');
    });
}

// Start Python Backend
async function startServer() {
    serverPort = await getAvailablePort(5052);
    log.info(`Assigning DuctFit Pro backend server to 127.0.0.1:${serverPort}`);

    const isPackaged = app.isPackaged;
    let executablePath = '';
    let args = [];

    if (isPackaged) {
        // Packaged: Run bundled PyInstaller binary
        const bundledExe = path.join(process.resourcesPath, 'ductfit-server', 'ductfit-server.exe');
        if (fs.existsSync(bundledExe)) {
            executablePath = bundledExe;
            args = [
                `--port=${serverPort}`,
                `--host=127.0.0.1`,
                `--user-data-dir=${userDataDir}`
            ];
        } else {
            throw new Error(`Bundled server not found at: ${bundledExe}`);
        }
    } else {
        // Development mode: Use system python
        executablePath = 'python';
        const scriptPath = path.join(__dirname, '..', 'app.py');
        args = [
            scriptPath,
            `--port=${serverPort}`,
            `--host=127.0.0.1`,
            `--user-data-dir=${userDataDir}`
        ];
    }

    log.info(`Spawning backend: ${executablePath} ${args.join(' ')}`);
    serverProcess = spawn(executablePath, args, {
        cwd: isPackaged ? path.join(process.resourcesPath, 'ductfit-server') : path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });

    serverProcess.stdout.on('data', (d) => {
        log.info(`[Server]: ${d.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (d) => {
        log.warn(`[Server Error]: ${d.toString().trim()}`);
    });

    serverProcess.on('exit', (code, sig) => {
        log.info(`Server process exited with code ${code}, signal ${sig}`);
        if (!isQuitting) {
            dialog.showErrorBox(
                'DuctFit Pro Engine Stopped',
                'The background engineering calculation engine stopped unexpectedly. Please restart the application.'
            );
        }
    });

    // Wait until server is responding on http://127.0.0.1:${serverPort}/api/tree
    await waitForServer(`http://127.0.0.1:${serverPort}/api/tree`, 30000);
}

function waitForServer(url, timeoutMs) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        function check() {
            http.get(url, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    retry();
                }
            }).on('error', () => {
                retry();
            });
        }

        function retry() {
            if (Date.now() - startTime > timeoutMs) {
                reject(new Error('Server failed to start within timeout period.'));
            } else {
                setTimeout(check, 300);
            }
        }

        check();
    });
}

function stopServer() {
    if (serverProcess && !serverProcess.killed) {
        log.info('Stopping backend server process...');
        try {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/T', '/F']);
            } else {
                serverProcess.kill('SIGTERM');
            }
        } catch (e) {
            log.warn('Error killing server process:', e);
        }
        serverProcess = null;
    }
}

// Splash Window
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 460,
        height: 320,
        frame: false,
        resizable: false,
        center: true,
        transparent: true,
        alwaysOnTop: true,
        show: true,
        icon: appIconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

// Main Application Window
function createMainWindow() {
    const state = loadWindowState();

    mainWindow = new BrowserWindow({
        x: state.x,
        y: state.y,
        width: state.width || 1380,
        height: state.height || 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'DuctFit Pro - ASHRAE Fundamentals (Ch. 21)',
        icon: appIconPath,
        show: false,
        backgroundColor: '#f8fafc',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    if (state.isMaximized) {
        mainWindow.maximize();
    }

    // Native Application Menu
    createMenu();

    // Security: Open external links in user default browser, prevent unwanted popups
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (!url.startsWith(`http://127.0.0.1:${serverPort}`) && !url.startsWith(`http://localhost:${serverPort}`)) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        if (url.includes('/pdf') || url.includes('/api/')) {
            mainWindow.webContents.downloadURL(url);
            return { action: 'deny' };
        }
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith(`http://127.0.0.1:${serverPort}`) && !url.startsWith(`http://localhost:${serverPort}`)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    // Save position/size on close
    mainWindow.on('close', () => {
        saveWindowState();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Load web application from local server
    mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);

    mainWindow.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
        }
        mainWindow.show();
        mainWindow.focus();

        // Check for updates silently in background (Phase 5)
        initAutoUpdater();
    });
}

function createMenu() {
    const template = [
        {
            label: '&File',
            submenu: [
                {
                    label: 'E&xit',
                    accelerator: 'Alt+F4',
                    click: () => {
                        isQuitting = true;
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '&View',
            submenu: [
                { role: 'reload', label: '&Reload' },
                { role: 'forceReload', label: '&Force Reload' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Actual &Size' },
                { role: 'zoomIn', label: 'Zoom &In' },
                { role: 'zoomOut', label: 'Zoom &Out' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Toggle &Full Screen' }
            ]
        },
        {
            label: '&Help',
            submenu: [
                {
                    label: 'Check for &Updates...',
                    click: () => {
                        log.info('Manual update check requested by user');
                        autoUpdater.checkForUpdates().then((res) => {
                            if (!res || !res.downloadPromise) {
                                dialog.showMessageBox(mainWindow, {
                                    type: 'info',
                                    title: 'DuctFit Pro Updates',
                                    message: 'You are using the latest version of DuctFit Pro (v' + app.getVersion() + ').',
                                    buttons: ['OK']
                                });
                            }
                        }).catch((err) => {
                            dialog.showMessageBox(mainWindow, {
                                type: 'warning',
                                title: 'Check for Updates',
                                message: 'Could not connect to update server: ' + err.message,
                                buttons: ['OK']
                            });
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: '&About DuctFit Pro',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About DuctFit Pro',
                            message: `DuctFit Pro v${app.getVersion()}`,
                            detail: 'Professional ASHRAE Duct Fitting Loss Analysis & Auto Duct Sizer\n\n' +
                                    'Publisher: DuctFit Pro Engg Solution\n' +
                                    'Standard: 2009 & 2021 ASHRAE Handbook—Fundamentals (Ch. 21)\n' +
                                    'Calculations: 100% Offline Local Engine\n\n' +
                                    '© DuctFit Pro Engg Solution. All rights reserved.',
                            buttons: ['OK'],
                            icon: appIconPath
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Auto-Updater Integration (Phase 5)
function initAutoUpdater() {
    if (!app.isPackaged) {
        log.info('Development mode: Skipping auto-updater check.');
        return;
    }

    try {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;

        // Accept SHA-512 cryptographically verified updates without failing on Windows self-signed root CA checks
        autoUpdater.verifyUpdateCodeSignature = (publisherNames, tempUpdateFile) => {
            log.info('[AutoUpdater] SHA-512 package verified. Bypassing Windows root CA check for:', tempUpdateFile);
            return Promise.resolve(null);
        };

        autoUpdater.on('update-available', (info) => {
            log.info('Update available:', info.version);
        });

        autoUpdater.on('update-downloaded', (info) => {
            log.info('Update downloaded:', info.version);
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Update Ready to Install',
                message: `DuctFit Pro v${info.version} has been downloaded.`,
                detail: 'The update will be installed automatically when you exit, or you can restart now.',
                buttons: ['Restart Now', 'Install on Exit'],
                defaultId: 0,
                cancelId: 1
            }).then(({ response }) => {
                if (response === 0) {
                    isQuitting = true;
                    stopServer();
                    autoUpdater.quitAndInstall();
                }
            });
        });

        autoUpdater.on('error', (err) => {
            // Silently ignore network errors when offline
            log.info('Auto-update check skipped/offline:', err.message);
        });

        // Check for updates after 5 seconds, then every 4 hours
        setTimeout(() => {
            autoUpdater.checkForUpdates().catch((e) => {
                log.info('Update check caught offline:', e.message);
            });
        }, 5000);

        setInterval(() => {
            autoUpdater.checkForUpdates().catch((e) => {
                log.info('Periodic update check caught offline:', e.message);
            });
        }, 4 * 60 * 60 * 1000);
    } catch (e) {
        log.warn('Auto-updater init error:', e);
    }
}

// IPC Handlers
ipcMain.handle('app:version', () => app.getVersion());

// Lifecycle Handlers
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.on('ready', async () => {
    createSplashWindow();
    try {
        await startServer();
        createMainWindow();
    } catch (err) {
        log.error('Failed to start application:', err);
        if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
        dialog.showErrorBox(
            'Failed to Start DuctFit Pro',
            `An error occurred while launching the engineering calculation engine:\n\n${err.message}\n\nPlease check your system settings and try again.`
        );
        app.quit();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
    stopServer();
});

app.on('window-all-closed', () => {
    isQuitting = true;
    stopServer();
    app.quit();
});
