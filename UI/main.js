const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;
let devToolsWindow;
let serverProcess;
let isServerRunning = false;
let isMonitoringMiniProgram = false;

function createWindow() {
    // 创建主窗口
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: '微信小程序调试器',
        frame: false, // 移除默认窗口边框
        titleBarStyle: 'hidden', // 隐藏标题栏
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
        }
    });

    // 移除默认菜单
    Menu.setApplicationMenu(null);

    // 加载app.html界面
    mainWindow.loadFile(path.join(__dirname, 'app.html'));

    // 打开开发者工具（如果需要调试UI）
    // mainWindow.webContents.openDevTools();

    // 窗口关闭事件
    mainWindow.on('closed', function () {
        stopServer();
        if (devToolsWindow) {
            devToolsWindow.close();
        }
        mainWindow = null;
    });
}

// 启动后端服务器
function startServer() {
    // 使用编译后的JavaScript文件而不是直接使用ts-node
    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    serverProcess = spawn('node', [serverPath], {
        cwd: path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'] // 捕获stdout和stderr
    });

    // 收集并发送日志到主窗口
    function sendLog(type, message) {
        if (mainWindow) {
            mainWindow.webContents.send('log-message', {
                type: type,
                message: message,
                timestamp: new Date().toLocaleTimeString()
            });
        }
        console[type === 'error' ? 'error' : 'log'](message);
    }

    // 记录服务启动时间
    const serviceStartTime = new Date();
    
    serverProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
            sendLog('info', output);
            
            // 只有在监控正式启动后才处理自动打开逻辑
            if (monitoringStarted) {
                // 检测是否有微信小程序相关日志（更精确的检测）
                const miniProgramKeywords = [
                    '微信小程序', 'WMPF', 'Mini Program', '小程序启动', 
                    'AppService started', '小程序已加载', 'wxapkg loaded',
                    '小程序客户端已连接', 'CDP瀹㈡埛绔凡杩炴帴', 'CDP客户端已连接'
                ];
                
                // 检查是否有小程序启动的关键词（排除停止操作）
                const isMiniProgramStarted = miniProgramKeywords.some(keyword => 
                    output.includes(keyword) && !output.includes('停止') && !output.includes('closed') && !output.includes('已断开连接')
                );
                
                // 检查日志中是否包含时间戳，判断是否是启动后产生的日志
                const hasRecentTimestamp = /\d{2}:\d{2}:\d{2}/.test(output) && 
                    output.substring(output.lastIndexOf(' ') + 1) > serviceStartTime.toLocaleTimeString();
                
                // 特殊处理：如果检测到CDP客户端已连接，直接打开控制台
                if ((output.includes('CDP瀹㈡埛绔凡杩炴帴') || output.includes('CDP客户端已连接') || output.includes('小程序客户端已连接')) && !devToolsWindow) {
                    sendLog('success', '检测到微信小程序已连接，立即打开控制台...');
                    openDevToolsAutomatically(); // 立即打开，不延迟
                    hasOpenedDevTools = true;
                }
                // 只有满足以下条件才自动打开控制台：
                // 1. 检测到小程序启动
                // 2. 控制台尚未打开
                // 3. 日志内容是启动后产生的（或者日志中没有时间戳）
                else if (isMiniProgramStarted && !devToolsWindow && (!hasRecentTimestamp || (hasRecentTimestamp && monitoringStarted))) {
                    sendLog('success', '检测到微信小程序已启动，立即打开控制台...');
                    openDevToolsAutomatically(); // 立即打开，不延迟
                    hasOpenedDevTools = true;
                }
                
                // 如果检测到小程序切换，也刷新控制台
                if ((output.includes('切换小程序') || output.includes('switch to')) && devToolsWindow) {
                    sendLog('info', '检测到小程序切换，自动刷新控制台...', new Date().toLocaleTimeString());
                    devToolsWindow.reload();
                }
            }
        }
    });

    serverProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
            sendLog('error', output);
        }
    });

    serverProcess.on('spawn', () => {
        isServerRunning = true;
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: true });
            sendLog('success', '服务器进程已成功启动');
            sendLog('info', '开始监听微信小程序启动...');
        }
        // 启动微信小程序进程监控
        startMiniProgramMonitoring();
    });

    serverProcess.on('close', (code) => {
        isServerRunning = false;
        stopMiniProgramMonitoring();
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: false });
            sendLog('info', `服务器进程已退出，退出码: ${code}`);
        }
        if (devToolsWindow) {
            devToolsWindow.close();
            devToolsWindow = null;
        }
    });

    serverProcess.on('error', (err) => {
        isServerRunning = false;
        stopMiniProgramMonitoring();
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: false });
            sendLog('error', '启动服务器失败: ' + err.message);
        }
    });
}

// 关闭后端服务器
function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
    isServerRunning = false;
    if (mainWindow) {
        mainWindow.webContents.send('server-status', { running: false });
    }
    if (devToolsWindow) {
        devToolsWindow.close();
        devToolsWindow = null;
    }
}

// IPC事件处理
ipcMain.on('start-server', () => {
    startServer();
});

ipcMain.on('stop-server', () => {
    stopServer();
});

ipcMain.on('open-devtools', () => {
    if (isServerRunning && !devToolsWindow) {
        // 创建DevTools窗口
        devToolsWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            title: '微信小程序调试器控制台',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false, // 允许加载devtools协议
            }
        });

        // 加载Chrome DevTools界面
        devToolsWindow.loadURL('devtools://devtools/bundled/inspector.html?ws=127.0.0.1:62000');

        // 窗口关闭事件
        devToolsWindow.on('closed', function () {
            devToolsWindow = null;
        });
    } else if (!isServerRunning) {
        // 如果服务器未运行，通知主窗口
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: false });
        }
    }
});

// 刷新控制台
ipcMain.on('refresh-devtools', () => {
    if (isServerRunning && devToolsWindow) {
        devToolsWindow.reload();
        // 发送日志
        if (mainWindow) {
            mainWindow.webContents.send('log-message', {
                type: 'info',
                message: '控制台已刷新',
                timestamp: new Date().toLocaleTimeString()
            });
        }
    }
});

// 打开外部URL
ipcMain.on('open-url', (event, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    if (mainWindow) {
        mainWindow.webContents.send('log-message', {
            type: 'info',
            message: `已打开外部链接: ${url}`,
            timestamp: new Date().toLocaleTimeString()
        });
    }
});

// 打开日志目录
ipcMain.on('open-log-folder', () => {
    const { shell } = require('electron');
    const path = require('path');
    const logFolder = path.join(__dirname, '..');
    shell.openPath(logFolder);
    if (mainWindow) {
        mainWindow.webContents.send('log-message', {
            type: 'info',
            message: `已打开日志目录: ${logFolder}`,
            timestamp: new Date().toLocaleTimeString()
        });
    }
});

// 窗口控制
ipcMain.on('window-minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

// 自动打开控制台
function openDevToolsAutomatically() {
    if (isServerRunning && monitoringStarted && !devToolsWindow) {
        // 创建DevTools窗口
        devToolsWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            title: '微信小程序调试器控制台',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false, // 允许加载devtools协议
            }
        });

        // 加载Chrome DevTools界面
        devToolsWindow.loadURL('devtools://devtools/bundled/inspector.html?ws=127.0.0.1:62000');

        // 窗口关闭事件
        devToolsWindow.on('closed', function () {
            devToolsWindow = null;
            hasOpenedDevTools = false; // 重置标记，允许下次自动打开
            // 发送日志
            if (mainWindow) {
                mainWindow.webContents.send('log-message', {
                    type: 'info',
                    message: '控制台窗口已关闭，可以启动新小程序自动打开',
                    timestamp: new Date().toLocaleTimeString()
                });
            }
        });
        
        // 发送日志
        if (mainWindow) {
            mainWindow.webContents.send('log-message', {
                type: 'success',
                message: '检测到新开微信小程序，已自动打开控制台',
                timestamp: new Date().toLocaleTimeString()
            });
        }
    } else if (!monitoringStarted) {
        sendLog('info', '正在初始化监控，暂不执行自动打开操作');
    }
}

// 检测微信小程序进程
let initialWeChatProcesses = [];
let monitoringStarted = false;
let hasOpenedDevTools = false; // 标记是否已经自动打开过控制台
let pidLine = ''; // 用于进程解析的临时变量
let hasSentInitialLog = false; // 防止重复发送初始进程记录的日志
let lastProcessCount = -1; // 上次检测到的进程数量，用于防止重复日志

// 启动微信小程序进程监控
function startMiniProgramMonitoring() {
    if (isMonitoringMiniProgram) return;
    
    isMonitoringMiniProgram = true;
    monitoringStarted = false;
    
    // 第一步：记录当前已存在的微信小程序进程
    setTimeout(() => {
        const process = spawn('wmic', ['process', 'get', 'commandline,processid', '/format:list'], 
                            { shell: true, encoding: 'binary' });
        
        process.stdout.on('data', (data) => {
            const output = data.toString('binary');
            const processes = [];
            
            // 解析命令行参数
            const lines = output.split(/\r?\n/);
            lines.forEach(line => {
                if (line.includes('WeChat.exe') && line.includes('--wmpf') && !line.includes('WMPFDebugger')) {
                    const parts = line.split('=');
                    if (parts.length > 1) {
                        const pid = parts[1].trim();
                        if (pid && !isNaN(pid)) {
                            processes.push(pid);
                        }
                    }
                }
            });
            
            initialWeChatProcesses = processes;
            monitoringStarted = true;
            if (!hasSentInitialLog) {
                sendLog('success', `已记录当前${processes.length}个微信小程序进程，开始监控新进程...`);
                hasSentInitialLog = true;
                
                if (processes.length > 0) {
                    sendLog('info', '注意：当前已有的小程序不会触发自动打开，需要新建小程序');
                }
            }
        });
        
        process.stderr.on('data', (data) => {
            sendLog('error', '获取进程列表失败: ' + data.toString());
            monitoringStarted = true;
        });
        
        process.on('error', (err) => {
            sendLog('error', '执行命令失败: ' + err.message);
            monitoringStarted = true;
        });
    }, 2000);
    
    // 第二步：开始监控新进程
    const interval = setInterval(() => {
        if (!isServerRunning) {
            clearInterval(interval);
            isMonitoringMiniProgram = false;
            monitoringStarted = false;
            return;
        }
        
        // 等待初始记录完成
        if (!monitoringStarted) return;
        
        // 检查微信小程序相关进程（更精确的检测）
        const process = spawn('wmic', ['process', 'get', 'commandline,processid', '/format:list'], 
                            { shell: true, encoding: 'binary' });
        
        process.stdout.on('data', (data) => {
            const output = data.toString('binary');
            const processes = [];
            
            // 解析命令行参数
            const lines = output.split(/\r?\n/);
            lines.forEach(line => {
                if (line.includes('WeChat.exe') && line.includes('--wmpf') && !line.includes('WMPFDebugger')) {
                    const parts = line.split('=');
                    if (parts.length > 1) {
                        const pid = parts[1].trim();
                        if (pid && !isNaN(pid)) {
                            processes.push(pid);
                        }
                    }
                }
            });
            
            // 检测新启动的微信小程序进程（只统计启动后新建的）
            const newProcesses = processes.filter(pid => !initialWeChatProcesses.includes(pid));
            
            if (newProcesses.length > 0 && processes.length !== lastProcessCount) {
                sendLog('success', `检测到${newProcesses.length}个新微信小程序进程已启动`);
                
                // 立即打开控制台
                openDevToolsAutomatically();
                
                // 更新初始进程列表，避免重复检测
                initialWeChatProcesses = [...initialWeChatProcesses, ...newProcesses];
                lastProcessCount = processes.length;
            }
        });
        
        process.stderr.on('data', (data) => {
            sendLog('error', '获取进程列表失败: ' + data.toString());
        });
        
        process.on('error', (err) => {
            sendLog('error', '执行命令失败: ' + err.message);
        });
    }, 3000); // 每3秒检查一次，减少资源消耗
}

// 停止微信小程序进程监控
function stopMiniProgramMonitoring() {
    isMonitoringMiniProgram = false;
}

// 发送日志到主窗口
function sendLog(type, message) {
    if (mainWindow) {
        mainWindow.webContents.send('log-message', {
            type: type,
            message: message,
            timestamp: new Date().toLocaleTimeString()
        });
    }
    console[type === 'error' ? 'error' : 'log'](message);
}

// 应用程序就绪事件
app.on('ready', () => {
    createWindow();
});

// 所有窗口关闭事件
app.on('window-all-closed', function () {
    stopServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 打开外部URL
ipcMain.on('open-url', (event, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    if (mainWindow) {
        mainWindow.webContents.send('log-message', {
            type: 'info',
            message: `已打开外部链接: ${url}`,
            timestamp: new Date().toLocaleTimeString()
        });
    }
});

// 打开日志目录
ipcMain.on('open-log-folder', () => {
    const { shell } = require('electron');
    const path = require('path');
    const logFolder = path.join(__dirname, '..');
    shell.openPath(logFolder);
    if (mainWindow) {
        mainWindow.webContents.send('log-message', {
            type: 'info',
            message: `已打开日志目录: ${logFolder}`,
            timestamp: new Date().toLocaleTimeString()
        });
    }
});

// 窗口控制
ipcMain.on('window-minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

// 激活应用程序事件（macOS）
app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});
