// 测试微信小程序进程检测功能
const { spawn } = require('child_process');

console.log('=== WMPFDebugger 自动打开控制台功能测试 ===');

// 测试 wmic 命令
console.log('\n1. 测试 wmic 命令...');
const wmicProcess = spawn('wmic', ['process', 'get', 'commandline,processid', '/format:list'], { shell: true });

wmicProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('WeChat.exe')) {
        console.log('检测到微信进程');
        console.log('================================');
        console.log('原始输出:');
        const lines = output.split(/\r?\n/);
        lines.slice(0, 5).forEach(line => {
            if (line.trim()) {
                console.log(line);
            }
        });
        console.log('...');
    }
});

wmicProcess.stderr.on('data', (data) => {
    console.error('wmic 命令错误:', data.toString());
});

// 测试 powershell 命令
console.log('\n2. 测试系统日志检测...');
const psProcess = spawn('powershell', ['-Command', 'Get-EventLog -LogName Application -Newest 5 | Select-Object -ExpandProperty Message'], { shell: true });

psProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('系统日志输出:');
    if (output.trim()) {
        console.log(output);
    } else {
        console.log('无微信相关事件日志');
    }
});

psProcess.stderr.on('data', (data) => {
    console.error('PowerShell 命令错误:', data.toString());
});

console.log('\n3. 测试完成，请检查结果');