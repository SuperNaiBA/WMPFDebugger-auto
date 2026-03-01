"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_events_1 = require("node:events");
const node_path_1 = __importDefault(require("node:path"));
const frida = __importStar(require("frida"));
const ws_1 = __importStar(require("ws"));
const codex = require("./third-party/RemoteDebugCodex.js");
const messageProto = require("./third-party/WARemoteDebugProtobuf.js");
class DebugMessageEmitter extends node_events_1.EventEmitter {
}
;
// default debugging port, do not change
const DEBUG_PORT = 9421;
// CDP port, change to whatever you like
// use this port by navigating to devtools://devtools/bundled/inspector.html?ws=127.0.0.1:${CDP_PORT}
const CDP_PORT = 62000;
// debug switch
const DEBUG = false;
const debugMessageEmitter = new DebugMessageEmitter();
const bufferToHexString = (buffer) => {
    return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join("");
};
const debug_server = () => {
    const wss = new ws_1.WebSocketServer({ port: DEBUG_PORT });
    console.log(`[服务器] 调试服务器运行在 ws://localhost:${DEBUG_PORT}`);
    let messageCounter = 0;
    const onMessage = (message) => {
        DEBUG && console.log(`[client] received raw message (hex): ${bufferToHexString(message)}`);
        let unwrappedData = null;
        try {
            const decodedData = messageProto.mmbizwxadevremote.WARemoteDebug_DebugMessage.decode(message);
            unwrappedData = codex.unwrapDebugMessageData(decodedData);
            DEBUG && console.log(`[client] [DEBUG] decoded data:`);
            DEBUG && console.dir(unwrappedData);
        }
        catch (e) {
            console.error(`[客户端] 错误: ${e}`);
        }
        if (unwrappedData === null) {
            return;
        }
        if (unwrappedData.category === "chromeDevtoolsResult") {
            // need to proxy to CDP client
            debugMessageEmitter.emit("cdpmessage", unwrappedData.data.payload);
        }
    };
    wss.on("connection", (ws) => {
        console.log("[连接] 小程序客户端已连接");
        ws.on("message", onMessage);
        ws.on("error", (err) => { console.error("[客户端] 错误:", err); });
        ws.on("close", () => { console.log("[客户端] 客户端已断开连接"); });
    });
    debugMessageEmitter.on("proxymessage", (message) => {
        wss && wss.clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                // encode CDP and send to miniapp
                // wrapDebugMessageData(data, category, compressAlgo)
                const rawPayload = {
                    jscontext_id: "",
                    op_id: Math.round(100 * Math.random()),
                    payload: message.toString()
                };
                DEBUG && console.log(rawPayload);
                const wrappedData = codex.wrapDebugMessageData(rawPayload, "chromeDevtools", 0);
                const outData = {
                    seq: ++messageCounter,
                    category: "chromeDevtools",
                    data: wrappedData.buffer,
                    compressAlgo: 0,
                    originalSize: wrappedData.originalSize
                };
                const encodedData = messageProto.mmbizwxadevremote.WARemoteDebug_DebugMessage.encode(outData).finish();
                client.send(encodedData, { binary: true });
            }
        });
    });
};
const proxy_server = () => {
    const wss = new ws_1.WebSocketServer({ port: CDP_PORT });
    console.log(`[服务器] 代理服务器运行在 ws://localhost:${CDP_PORT}`);
    const onMessage = (message) => {
        debugMessageEmitter.emit("proxymessage", message);
    };
    wss.on("connection", (ws) => {
        console.log("[连接] CDP客户端已连接");
        ws.on("message", onMessage);
        ws.on("error", (err) => { console.error("[客户端] CDP错误:", err); });
        ws.on("close", () => { console.log("[客户端] CDP客户端已断开连接"); });
    });
    debugMessageEmitter.on("cdpmessage", (message) => {
        wss && wss.clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                // send CDP message to devtools
                client.send(message);
            }
        });
    });
};
const frida_server = async () => {
    try {
        const localDevice = await frida.getLocalDevice();
        const processes = await localDevice.enumerateProcesses({ scope: frida.Scope.Metadata });
        const wmpfProcesses = processes.filter(process => process.name === "WeChatAppEx.exe");
        const wmpfPids = wmpfProcesses.map(p => p.parameters.ppid ? p.parameters.ppid : 0);
        // find the parent process
        const wmpfPid = wmpfPids.sort((a, b) => wmpfPids.filter(v => v === a).length - wmpfPids.filter(v => v === b).length).pop();
        if (wmpfPid === undefined) {
            console.log("[frida] WeChatAppEx.exe进程未找到。等待进程启动...");
            return;
        }
        const wmpfProcess = processes.filter(process => process.pid === wmpfPid)[0];
        const wmpfProcessPath = wmpfProcess.parameters.path;
        const wmpfVersionMatch = wmpfProcessPath ? wmpfProcessPath.match(/\d+/g) : "";
        const wmpfVersion = wmpfVersionMatch ? new Number(wmpfVersionMatch.pop()) : 0;
        if (wmpfVersion === 0) {
            console.error("[frida] 查找WMPF版本时出错");
            return false;
        }
        // attach to process
        const session = await localDevice.attach(Number(wmpfPid));
        // find hook script
        const mainFilename = require.main?.filename || process.cwd();
        const projectRoot = node_path_1.default.join(node_path_1.default.dirname(mainFilename), "..");
        // 尝试读取外部frida配置文件（如果存在），否则读取打包内的
        const fridaConfigDir = "frida/config";
        const externalConfigDir = node_path_1.default.join(process.cwd(), fridaConfigDir);
        const internalConfigDir = node_path_1.default.join(projectRoot, fridaConfigDir);
        // 确定配置文件路径：优先外部，其次内部
        const getConfigPath = (filename) => {
            const externalPath = node_path_1.default.join(externalConfigDir, filename);
            const internalPath = node_path_1.default.join(internalConfigDir, filename);
            return externalPath;
        };
        // 确定hook脚本路径
        const getHookScriptPath = () => {
            const externalPath = node_path_1.default.join(process.cwd(), "frida/hook.js");
            const internalPath = node_path_1.default.join(projectRoot, "frida/hook.js");
            return externalPath;
        };
        let scriptContent = null;
        try {
            // 先尝试读取外部hook脚本
            scriptContent = (await node_fs_1.promises.readFile(getHookScriptPath())).toString();
            console.log("[frida] 已加载外部hook脚本");
        }
        catch (e) {
            try {
                // 如果外部不存在，读取内部hook脚本
                scriptContent = (await node_fs_1.promises.readFile(node_path_1.default.join(projectRoot, "frida/hook.js"))).toString();
                console.log("[frida] 已加载内部hook脚本");
            }
            catch (e) {
                console.error("[frida] 未找到hook脚本");
                return false;
            }
        }
        let configContent = null;
        try {
            // 先尝试读取外部配置文件
            configContent = (await node_fs_1.promises.readFile(getConfigPath(`addresses.${wmpfVersion}.json`))).toString();
            configContent = JSON.stringify(JSON.parse(configContent));
            console.log(`[frida] 已加载外部版本配置: ${wmpfVersion}`);
        }
        catch (e) {
            try {
                // 如果外部不存在，读取内部配置文件
                configContent = (await node_fs_1.promises.readFile(node_path_1.default.join(projectRoot, "frida/config", `addresses.${wmpfVersion}.json`))).toString();
                configContent = JSON.stringify(JSON.parse(configContent));
                console.log(`[frida] 已加载内部版本配置: ${wmpfVersion}`);
            }
            catch (e) {
                console.error(`[frida] 未找到版本配置: ${wmpfVersion}`);
                return false;
            }
        }
        if (scriptContent === null || configContent === null) {
            console.error("[frida] 无法找到hook脚本");
            return false;
        }
        // load script
        const script = await session.createScript(scriptContent.replace("@@CONFIG@@", configContent));
        script.message.connect(message => {
            console.log("[frida客户端]", message);
        });
        await script.load();
        console.log(`[frida] 脚本已加载，WMPF版本: ${wmpfVersion}, 进程ID: ${wmpfPid}`);
        return true;
    }
    catch (error) {
        console.error(`[frida] 错误: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
};
const main = async () => {
    debug_server();
    proxy_server();
    await frida_server();
};
(async () => {
    await main();
})();
