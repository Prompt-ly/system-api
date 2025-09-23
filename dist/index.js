var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/windows/windows.ts
var exports_windows = {};
__export(exports_windows, {
  Process: () => Process,
  Apps: () => Apps
});

// src/windows/apps/registry.ts
import { exec } from "node:child_process";

class Registry {
  static HKLM = "HKEY_LOCAL_MACHINE";
  static HKCU = "HKEY_CURRENT_USER";
  hive;
  key;
  constructor(opts) {
    this.hive = opts.hive;
    this.key = opts.key;
  }
  keys(cb) {
    const fullPath = `${this.hive}${this.key}`;
    const cmd = `REG QUERY "${fullPath}"`;
    exec(cmd, (err, stdout) => {
      if (err)
        return cb(err);
      const subKeys = stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith(this.hive)).map((line) => new Registry({ hive: this.hive, key: line.replace(this.hive, "") }));
      cb(null, subKeys);
    });
  }
  values(cb) {
    const fullPath = `${this.hive}${this.key}`;
    const cmd = `REG QUERY "${fullPath}"`;
    exec(cmd, (err, stdout) => {
      if (err)
        return cb(err);
      const valueRegex = /^\s+([^\s]+)\s+REG_(\S+)\s+(.*)$/;
      const items = stdout.split(/\r?\n/).map((line) => line.match(valueRegex)).filter((match) => match !== null).map((match) => ({
        name: match[1] || "",
        type: match[2] || "",
        value: match[3] || ""
      }));
      cb(null, items);
    });
  }
}

// src/windows/apps/apps.ts
function hashStringToNumber(str) {
  let hash = 0;
  for (let i = 0;i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
function cleanIconPath(path) {
  let s = (path || "").trim();
  const lastComma = s.lastIndexOf(",");
  if (lastComma !== -1) {
    const right = s.slice(lastComma + 1).trim();
    if (/^-?\d+$/.test(right)) {
      s = s.slice(0, lastComma).trim();
    }
  }
  if (s.startsWith('"') && s.endsWith('"') || s.startsWith("'") && s.endsWith("'")) {
    s = s.slice(1, -1);
  }
  return s;
}
function cleanAppName(name) {
  if (!name)
    return name;
  return name.replace(/\s+v?\d+(\.\d+)*(\.\d+)*$/i, "").replace(/\s+\(\d+(\.\d+)*(\.\d+)*\)$/i, "").replace(/\s+-\s*\d+(\.\d+)*(\.\d+)*$/i, "").replace(/\s+\d{4}$/i, "").trim();
}
async function fetchRegistryApps() {
  const keys = [
    { hive: Registry.HKLM, key: "\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" },
    { hive: Registry.HKLM, key: "\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall" },
    { hive: Registry.HKCU, key: "\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" },
    { hive: Registry.HKCU, key: "\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall" }
  ];
  const apps = [];
  for (const k of keys) {
    try {
      const reg = new Registry({ hive: k.hive, key: k.key });
      const children = await new Promise((resolve) => reg.keys((err, sub) => resolve(err ? [] : sub || [])));
      const items = await Promise.all(children.map((sub) => new Promise((resolve) => {
        const registryKey = sub.key.split("\\").pop() || "";
        sub.values((_err, values) => {
          const app = { registryKey };
          for (const v of values || []) {
            if (v.name === "QuietDisplayName")
              app.name = v.value;
            if (v.name === "DisplayName" && !app.name)
              app.name = v.value;
            if (v.name === "DisplayVersion")
              app.version = v.value;
            if (v.name === "Publisher")
              app.publisher = v.value;
            if (v.name === "DisplayIcon")
              app.icon = cleanIconPath(v.value);
            if (v.name === "Comments" || v.name === "LocalizedDescription")
              app.description = v.value;
          }
          resolve(app.name ? app : null);
        });
      })));
      apps.push(...items.filter((item) => item !== null && item.registryKey !== undefined));
    } catch {}
  }
  const seen = new Set;
  const uniqueApps = apps.filter((app) => {
    if (app.name && !seen.has(app.name)) {
      seen.add(app.name);
      return true;
    }
    return false;
  });
  return uniqueApps.filter((app) => app?.name !== undefined).map((app) => ({
    id: hashStringToNumber(app.registryKey),
    name: cleanAppName(app.name) || "",
    version: app.version || "",
    publisher: app.publisher || "",
    description: app.description || "",
    icon: app.icon || null
  }));
}

class WindowsAppRegistry {
  apps = [];
  async fetch() {
    this.apps = await fetchRegistryApps();
  }
  listApps() {
    return this.apps;
  }
  getApp(id) {
    return this.apps.find((app) => app.id === id) || null;
  }
  uninstallApp(_id) {
    return false;
  }
}

// src/windows/process/process.ts
import koffi3 from "koffi";

// src/utils/koffi-utils.ts
function wideCharArrayToString(arr) {
  const chars = [];
  for (let i = 0;i < arr.length; i++) {
    const char = arr[i];
    if (char === undefined || char === 0)
      break;
    chars.push(char);
  }
  return String.fromCharCode(...chars);
}

// src/windows/process/koffi-defs.ts
import koffi2 from "koffi";

// src/utils/koffi-globals.ts
import koffi from "koffi";
var kernel32 = koffi.load("kernel32.dll");
var advapi32 = koffi.load("advapi32.dll");

// src/windows/process/koffi-defs.ts
var PROCESSENTRY32W_STRUCT = koffi2.struct("PROCESSENTRY32W", {
  dwSize: "uint32",
  cntUsage: "uint32",
  th32ProcessID: "uint32",
  th32DefaultHeapID: "uintptr",
  th32ModuleID: "uint32",
  cntThreads: "uint32",
  th32ParentProcessID: "uint32",
  pcPriClassBase: "int32",
  dwFlags: "uint32",
  szExeFile: koffi2.array("uint16", 260)
});
var CreateToolhelp32Snapshot = kernel32.func("CreateToolhelp32Snapshot", "void*", ["uint32", "uint32"]);
var Process32FirstW = kernel32.func("Process32FirstW", "bool", ["void*", "void*"]);
var Process32NextW = kernel32.func("Process32NextW", "bool", ["void*", "void*"]);
var CloseHandle = kernel32.func("CloseHandle", "bool", ["void*"]);
var OpenProcess = kernel32.func("OpenProcess", "void*", ["uint32", "bool", "uint32"]);
var TerminateProcess = kernel32.func("TerminateProcess", "bool", ["void*", "uint32"]);
var GetLastError = kernel32.func("GetLastError", "uint32", []);
var TH32CS_SNAPPROCESS = 2;
var PROCESS_TERMINATE = 1;
var PROCESS_QUERY_INFORMATION = 1024;

// src/windows/process/process.ts
class WindowsProcessManager {
  listProcesses() {
    const processes = [];
    try {
      const hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
      if (!hSnapshot) {
        console.error("CreateToolhelp32Snapshot failed:", GetLastError());
        return [];
      }
      const pe32Buffer = Buffer.alloc(koffi3.sizeof(PROCESSENTRY32W_STRUCT));
      koffi3.encode(pe32Buffer, PROCESSENTRY32W_STRUCT, {
        dwSize: koffi3.sizeof(PROCESSENTRY32W_STRUCT),
        cntUsage: 0,
        th32ProcessID: 0,
        th32DefaultHeapID: 0,
        th32ModuleID: 0,
        cntThreads: 0,
        th32ParentProcessID: 0,
        pcPriClassBase: 0,
        dwFlags: 0,
        szExeFile: new Array(260).fill(0)
      });
      if (Process32FirstW(hSnapshot, pe32Buffer)) {
        do {
          const processEntry = koffi3.decode(pe32Buffer, PROCESSENTRY32W_STRUCT);
          const processName = wideCharArrayToString(processEntry.szExeFile);
          processes.push({
            id: processEntry.th32ProcessID,
            name: processName,
            status: "running",
            startTime: new Date(0)
          });
        } while (Process32NextW(hSnapshot, pe32Buffer));
      } else {
        const error = GetLastError();
        if (error !== 18) {
          console.error("Process32FirstW/NextW failed:", error);
        }
      }
      CloseHandle(hSnapshot);
    } catch (error) {
      console.error("Error in listProcesses:", error);
    }
    return processes;
  }
  getProcess(id) {
    const processes = this.listProcesses();
    return processes.find((p) => p.id === id) || null;
  }
  stopProcess(id) {
    let success = false;
    try {
      const hProcess = OpenProcess(PROCESS_TERMINATE | PROCESS_QUERY_INFORMATION, false, id);
      if (!hProcess) {
        const error = GetLastError();
        console.error(`Failed to open process ${id}. Error: ${error}. (Access Denied: 5)`);
        return false;
      }
      success = TerminateProcess(hProcess, 0);
      if (!success) {
        console.error(`Failed to terminate process ${id}. Error: ${GetLastError()}`);
      }
      CloseHandle(hProcess);
    } catch (e) {
      console.error(`Error stopping process ${id}:`, e);
    }
    return success;
  }
}

// src/windows/windows.ts
var Process = new WindowsProcessManager;
var Apps = new WindowsAppRegistry;
export {
  exports_windows as Windows
};
