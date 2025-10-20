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

// src/windows/apps/apps.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// src/windows/apps/icon-extractor.ts
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import koffi2 from "koffi";

// src/windows/apps/koffi-defs.ts
import koffi from "koffi";
var shell32 = koffi.load("shell32.dll");
var user32 = koffi.load("user32.dll");
var gdi32 = koffi.load("gdi32.dll");
var SHFILEINFOW = koffi.struct("SHFILEINFOW", {
  hIcon: "void*",
  iIcon: "int",
  dwAttributes: "uint32",
  szDisplayName: koffi.array("uint16", 260),
  szTypeName: koffi.array("uint16", 80)
});
var BITMAPINFOHEADER = koffi.struct("BITMAPINFOHEADER", {
  biSize: "uint32",
  biWidth: "int32",
  biHeight: "int32",
  biPlanes: "uint16",
  biBitCount: "uint16",
  biCompression: "uint32",
  biSizeImage: "uint32",
  biXPelsPerMeter: "int32",
  biYPelsPerMeter: "int32",
  biClrUsed: "uint32",
  biClrImportant: "uint32"
});
var BITMAP = koffi.struct("BITMAP", {
  bmType: "int32",
  bmWidth: "int32",
  bmHeight: "int32",
  bmWidthBytes: "int32",
  bmPlanes: "uint16",
  bmBitsPixel: "uint16",
  bmBits: "void*"
});
var IconInfoStruct = koffi.struct({
  fIcon: "bool",
  xHotspot: "uint32",
  yHotspot: "uint32",
  hbmMask: "void*",
  hbmColor: "void*"
});
var SHGetFileInfoW = shell32.func("SHGetFileInfoW", "uintptr_t", [
  koffi.pointer("uint16"),
  "uint32",
  koffi.out(koffi.pointer(SHFILEINFOW)),
  "uint32",
  "uint32"
]);
var ExtractIconExW = shell32.func("ExtractIconExW", "uint32", [
  koffi.pointer("uint16"),
  "int",
  koffi.out(koffi.pointer("void*")),
  koffi.out(koffi.pointer("void*")),
  "uint32"
]);
var DestroyIcon = user32.func("DestroyIcon", "bool", ["void*"]);
var GetIconInfo = user32.func("GetIconInfo", "bool", ["void*", koffi.out(koffi.pointer(IconInfoStruct))]);
var GetDIBits = gdi32.func("GetDIBits", "int", [
  "void*",
  "void*",
  "uint32",
  "uint32",
  koffi.out("void*"),
  koffi.out(koffi.pointer("void")),
  "uint32"
]);
var GetDC = user32.func("GetDC", "void*", ["void*"]);
var ReleaseDC = user32.func("ReleaseDC", "int", ["void*", "void*"]);
var DeleteObject = gdi32.func("DeleteObject", "bool", ["void*"]);
var GetObject = gdi32.func("GetObjectW", "int", ["void*", "int", koffi.out(koffi.pointer("void"))]);
var SHGFI_ICON = 256;
var SHGFI_SMALLICON = 1;
var DIB_RGB_COLORS = 0;
var ShellExecuteW = shell32.func("ShellExecuteW", "uintptr_t", [
  "void*",
  koffi.pointer("uint16"),
  koffi.pointer("uint16"),
  koffi.pointer("uint16"),
  koffi.pointer("uint16"),
  "int"
]);
var SW_SHOW = 5;

// src/windows/apps/icon-extractor.ts
var runAsync = (fn) => {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      try {
        resolve(fn());
      } catch (error) {
        reject(error);
      }
    });
  });
};
var IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".svg", ".ico"];
var EXECUTABLE_EXTENSIONS = [".exe", ".dll", ".cpl", ".ocx", ".scr"];
var MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};
var toWide = (s) => {
  const arr = new Uint16Array(s.length + 1);
  for (let i = 0;i < s.length; i++)
    arr[i] = s.charCodeAt(i);
  return arr;
};
var getMime = (ext) => MIME_TYPES[ext.toLowerCase()] || "image/png";
async function iconToBase64(hIcon) {
  if (!hIcon || hIcon === 0)
    return null;
  try {
    const iconInfo = {};
    const getIconInfoResult = await runAsync(() => GetIconInfo(hIcon, iconInfo));
    if (!getIconInfoResult) {
      await runAsync(() => DestroyIcon(hIcon));
      return null;
    }
    const hdc = await runAsync(() => GetDC(null));
    if (!hdc) {
      await runAsync(() => DestroyIcon(hIcon));
      return null;
    }
    const bitmapInfo = Buffer.alloc(koffi2.sizeof(BITMAP));
    const result = await runAsync(() => GetObject(iconInfo.hbmColor, koffi2.sizeof(BITMAP), bitmapInfo));
    if (result === 0) {
      await runAsync(() => ReleaseDC(null, hdc));
      await runAsync(() => DeleteObject(iconInfo.hbmMask));
      await runAsync(() => DeleteObject(iconInfo.hbmColor));
      await runAsync(() => DestroyIcon(hIcon));
      return null;
    }
    const bitmap = koffi2.decode(bitmapInfo, BITMAP);
    const width = Math.abs(bitmap.bmWidth);
    const height = Math.abs(bitmap.bmHeight);
    if (width === 0 || height === 0 || width > 256 || height > 256) {
      await runAsync(() => ReleaseDC(null, hdc));
      await runAsync(() => DeleteObject(iconInfo.hbmMask));
      await runAsync(() => DeleteObject(iconInfo.hbmColor));
      await runAsync(() => DestroyIcon(hIcon));
      return null;
    }
    const bmi = Buffer.alloc(1024);
    const bmiHeader = {
      biSize: 40,
      biWidth: width,
      biHeight: height,
      biPlanes: 1,
      biBitCount: 32,
      biCompression: 0,
      biSizeImage: 0,
      biXPelsPerMeter: 0,
      biYPelsPerMeter: 0,
      biClrUsed: 0,
      biClrImportant: 0
    };
    const bufferSize = width * height * 4;
    const pixelData = Buffer.alloc(bufferSize);
    koffi2.encode(bmi, BITMAPINFOHEADER, bmiHeader);
    const dibResult = await runAsync(() => GetDIBits(hdc, iconInfo.hbmColor, 0, height, pixelData, bmi, DIB_RGB_COLORS));
    await runAsync(() => ReleaseDC(null, hdc));
    await runAsync(() => DeleteObject(iconInfo.hbmMask));
    await runAsync(() => DeleteObject(iconInfo.hbmColor));
    await runAsync(() => DestroyIcon(hIcon));
    if (dibResult === 0) {
      return null;
    }
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0);
    icoHeader.writeUInt16LE(1, 2);
    icoHeader.writeUInt16LE(1, 4);
    const icoEntry = Buffer.alloc(16);
    icoEntry.writeUInt8(width >= 256 ? 0 : width, 0);
    icoEntry.writeUInt8(height >= 256 ? 0 : height, 1);
    icoEntry.writeUInt8(0, 2);
    icoEntry.writeUInt8(0, 3);
    icoEntry.writeUInt16LE(1, 4);
    icoEntry.writeUInt16LE(32, 6);
    icoEntry.writeUInt32LE(pixelData.length + 40, 8);
    icoEntry.writeUInt32LE(22, 12);
    const icoBitmapInfo = Buffer.alloc(40);
    icoBitmapInfo.writeUInt32LE(40, 0);
    icoBitmapInfo.writeInt32LE(width, 4);
    icoBitmapInfo.writeInt32LE(height * 2, 8);
    icoBitmapInfo.writeUInt16LE(1, 12);
    icoBitmapInfo.writeUInt16LE(32, 14);
    icoBitmapInfo.writeUInt32LE(0, 16);
    icoBitmapInfo.writeUInt32LE(pixelData.length, 20);
    icoBitmapInfo.writeInt32LE(0, 24);
    icoBitmapInfo.writeInt32LE(0, 28);
    icoBitmapInfo.writeUInt32LE(0, 32);
    icoBitmapInfo.writeUInt32LE(0, 36);
    const icoFile = Buffer.concat([icoHeader, icoEntry, icoBitmapInfo, pixelData]);
    const base64 = icoFile.toString("base64");
    return `data:image/x-icon;base64,${base64}`;
  } catch {
    return null;
  }
}
async function extractEmbeddedIcon(filePath, index = 0) {
  try {
    const wideFilePath = toWide(filePath);
    const largeIconPtr = [0];
    const smallIconPtr = [0];
    const count = await runAsync(() => ExtractIconExW(wideFilePath, index, largeIconPtr, smallIconPtr, 1));
    if (count > 0) {
      if (smallIconPtr[0]) {
        const small = await iconToBase64(smallIconPtr[0]);
        if (small)
          return small;
      }
      if (largeIconPtr[0]) {
        const large = await iconToBase64(largeIconPtr[0]);
        if (large)
          return large;
      }
    }
    if (index < 0) {
      const absIndex = Math.abs(index);
      const large2 = [0];
      const small2 = [0];
      const count2 = await runAsync(() => ExtractIconExW(wideFilePath, absIndex, large2, small2, 1));
      if (count2 > 0) {
        if (small2[0]) {
          const small = await iconToBase64(small2[0]);
          if (small)
            return small;
        }
        if (large2[0]) {
          const large = await iconToBase64(large2[0]);
          if (large)
            return large;
        }
      }
    }
    for (let i = 0;i < 8; i++) {
      const large3 = [0];
      const small3 = [0];
      const count3 = await runAsync(() => ExtractIconExW(wideFilePath, i, large3, small3, 1));
      if (count3 > 0) {
        if (small3[0]) {
          const small = await iconToBase64(small3[0]);
          if (small)
            return small;
        }
        if (large3[0]) {
          const large = await iconToBase64(large3[0]);
          if (large)
            return large;
        }
      }
    }
    const fileInfo = {};
    const wideFilePathForShell = toWide(filePath);
    const result = await runAsync(() => SHGetFileInfoW(wideFilePathForShell, 0, fileInfo, koffi2.sizeof(SHFILEINFOW), SHGFI_ICON | SHGFI_SMALLICON));
    if (result && fileInfo.hIcon) {
      return await iconToBase64(fileInfo.hIcon);
    }
    return null;
  } catch {
    return null;
  }
}
async function fileToBase64DataURI(filePath) {
  try {
    const buffer = await readFile(filePath);
    const ext = extname(filePath);
    const mimeType = getMime(ext);
    const base64 = buffer.toString("base64");
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}
function parsePathAndIndex(rawPath) {
  const trimmed = rawPath.trim().replace(/^"|"$/g, "");
  const idx = trimmed.lastIndexOf(",");
  if (idx > 1 && idx < rawPath.length - 1) {
    const path = trimmed.slice(0, idx);
    const rest = trimmed.slice(idx + 1).trim();
    const index = Number.parseInt(rest, 10);
    if (!Number.isNaN(index))
      return { path, index };
  }
  return { path: trimmed, index: 0 };
}
async function extractIconAsBase64(filePath) {
  if (!filePath || !filePath.trim())
    return null;
  const { path, index } = parsePathAndIndex(filePath.trim());
  const ext = extname(path).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) {
    return await fileToBase64DataURI(path);
  }
  if (EXECUTABLE_EXTENSIONS.includes(ext)) {
    return await extractEmbeddedIcon(path, index);
  }
  return null;
}

// src/windows/apps/apps.ts
var execFileAsync = promisify(execFile);
var runFetchAppsScript = async () => {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const scriptPath = join(thisDir, "fetch-apps.ps1");
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 * 128 });
  const raw = stdout.trim();
  if (!raw)
    return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch {
    return [];
  }
};

class WindowsAppRegistry {
  async fetchApps() {
    const apps = await runFetchAppsScript();
    return apps.map((app) => ({
      id: app.id,
      name: app.name,
      type: app.type,
      icon: {
        path: app.icon,
        getBase64: async () => await extractIconAsBase64(app.icon) ?? ""
      },
      launch: () => {
        if (app.type === "uwp") {
          execFileAsync("powershell.exe", [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            `Start-Process "shell:AppsFolder\\${app.launch}"`
          ], { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 * 128 });
        } else {
          const wide = Buffer.from(`${app.launch}\x00`, "utf16le");
          ShellExecuteW(null, null, wide, null, null, SW_SHOW);
        }
      }
    }));
  }
}

// src/windows/process/process.ts
import koffi5 from "koffi";

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
import koffi4 from "koffi";

// src/utils/koffi-globals.ts
import koffi3 from "koffi";
var kernel32 = koffi3.load("kernel32.dll");
var advapi32 = koffi3.load("advapi32.dll");

// src/windows/process/koffi-defs.ts
var PROCESSENTRY32W_STRUCT = koffi4.struct("PROCESSENTRY32W", {
  dwSize: "uint32",
  cntUsage: "uint32",
  th32ProcessID: "uint32",
  th32DefaultHeapID: "uintptr",
  th32ModuleID: "uint32",
  cntThreads: "uint32",
  th32ParentProcessID: "uint32",
  pcPriClassBase: "int32",
  dwFlags: "uint32",
  szExeFile: koffi4.array("uint16", 260)
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
      const pe32Buffer = Buffer.alloc(koffi5.sizeof(PROCESSENTRY32W_STRUCT));
      koffi5.encode(pe32Buffer, PROCESSENTRY32W_STRUCT, {
        dwSize: koffi5.sizeof(PROCESSENTRY32W_STRUCT),
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
          const processEntry = koffi5.decode(pe32Buffer, PROCESSENTRY32W_STRUCT);
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
