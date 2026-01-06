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
  Windows: () => Windows,
  Settings: () => Settings,
  Process: () => Process,
  Apps: () => Apps
});

// src/windows/apps/apps.ts
import { execFile, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// src/windows/apps/icon-extractor.ts
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import koffi3 from "koffi";

// src/windows/apps/koffi-defs.ts
import koffi2 from "koffi";

// src/utils/koffi-globals.ts
import koffi from "koffi";
var kernel32 = koffi.load("kernel32.dll");
var advapi32 = koffi.load("advapi32.dll");
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

// src/windows/apps/koffi-defs.ts
var shell32 = koffi2.load("shell32.dll");
var user32 = koffi2.load("user32.dll");
var gdi32 = koffi2.load("gdi32.dll");
var SHFILEINFOW = koffi2.struct("SHFILEINFOW", {
  hIcon: "void*",
  iIcon: "int",
  dwAttributes: "uint32",
  szDisplayName: koffi2.array("uint16", 260),
  szTypeName: koffi2.array("uint16", 80)
});
var BITMAP = koffi2.struct("BITMAP", {
  bmType: "int32",
  bmWidth: "int32",
  bmHeight: "int32",
  bmWidthBytes: "int32",
  bmPlanes: "uint16",
  bmBitsPixel: "uint16",
  bmBits: "void*"
});
var IconInfoStruct = koffi2.struct({
  fIcon: "bool",
  xHotspot: "uint32",
  yHotspot: "uint32",
  hbmMask: "void*",
  hbmColor: "void*"
});
var SHGetFileInfoW = shell32.func("SHGetFileInfoW", "uintptr_t", [
  koffi2.pointer("uint16"),
  "uint32",
  koffi2.out(koffi2.pointer(SHFILEINFOW)),
  "uint32",
  "uint32"
]);
var ExtractIconExW = shell32.func("ExtractIconExW", "uint32", [
  koffi2.pointer("uint16"),
  "int",
  koffi2.out(koffi2.pointer("void*")),
  koffi2.out(koffi2.pointer("void*")),
  "uint32"
]);
var DestroyIcon = user32.func("DestroyIcon", "bool", ["void*"]);
var GetIconInfo = user32.func("GetIconInfo", "bool", ["void*", koffi2.out(koffi2.pointer(IconInfoStruct))]);
var GetDIBits = gdi32.func("GetDIBits", "int", [
  "void*",
  "void*",
  "uint32",
  "uint32",
  koffi2.out("void*"),
  koffi2.out(koffi2.pointer("void")),
  "uint32"
]);
var GetDC = user32.func("GetDC", "void*", ["void*"]);
var ReleaseDC = user32.func("ReleaseDC", "int", ["void*", "void*"]);
var DeleteObject = gdi32.func("DeleteObject", "bool", ["void*"]);
var GetObject = gdi32.func("GetObjectW", "int", ["void*", "int", koffi2.out(koffi2.pointer("void"))]);
var SHGFI_ICON = 256;
var SHGFI_SMALLICON = 1;
var DIB_RGB_COLORS = 0;

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
    const bitmapInfo = Buffer.alloc(koffi3.sizeof(BITMAP));
    const result = await runAsync(() => GetObject(iconInfo.hbmColor, koffi3.sizeof(BITMAP), bitmapInfo));
    if (result === 0) {
      await runAsync(() => ReleaseDC(null, hdc));
      await runAsync(() => DeleteObject(iconInfo.hbmMask));
      await runAsync(() => DeleteObject(iconInfo.hbmColor));
      await runAsync(() => DestroyIcon(hIcon));
      return null;
    }
    const bitmap = koffi3.decode(bitmapInfo, BITMAP);
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
    koffi3.encode(bmi, BITMAPINFOHEADER, bmiHeader);
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
    const result = await runAsync(() => SHGetFileInfoW(wideFilePathForShell, 0, fileInfo, koffi3.sizeof(SHFILEINFOW), SHGFI_ICON | SHGFI_SMALLICON));
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
  windowManager;
  cachedApps = null;
  lastFetchTime = 0;
  CACHE_DURATION = 5 * 60 * 1000;
  setWindowManager(wm) {
    this.windowManager = wm;
  }
  async fetchApps() {
    if (this.cachedApps && Date.now() - this.lastFetchTime < this.CACHE_DURATION) {
      return this.cachedApps;
    }
    const apps = await runFetchAppsScript();
    this.cachedApps = apps.map((app) => ({
      id: app.id,
      name: app.name,
      path: app.launch,
      type: app.type,
      icon: {
        path: app.icon,
        getBase64: async () => await extractIconAsBase64(app.icon) ?? ""
      },
      open: async (newWindow) => {
        if (newWindow !== true && this.windowManager) {
          const windows = await this.windowManager.getAllOpenWindows();
          const myWindows = windows.filter((w) => w.app?.id === app.id);
          const win = myWindows[0];
          if (win) {
            win.focus();
            return;
          }
        }
        if (app.type === "uwp") {
          execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `Start-Process "shell:AppsFolder\\${app.launch}"`], { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 * 128 });
        } else {
          spawn(app.launch, [], { detached: true, stdio: "ignore" });
        }
      },
      getOpenWindows: async () => {
        if (!this.windowManager)
          return [];
        const windows = await this.windowManager.getAllOpenWindows();
        return windows.filter((w) => w.app?.id === app.id);
      }
    }));
    this.lastFetchTime = Date.now();
    return this.cachedApps;
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

// src/windows/settings/settings.ts
import { exec } from "node:child_process";
function launchSetting(id) {
  exec(`start ms-settings:${id}`);
}

class WindowsSettingRegistry {
  getSettings() {
    function setting(id, name) {
      return { id: `ms-settings:${id}`, name, open: () => launchSetting(id) };
    }
    const settings = [
      setting("workplace", "Access work or school"),
      setting("emailandaccounts", "Email & accounts"),
      setting("otherusers", "Other users"),
      setting("signinoptions", "Sign-in options"),
      setting("backup", "Windows Backup"),
      setting("yourinfo", "Your info"),
      setting("family-group", "Family"),
      setting("appsfeatures", "Apps & features"),
      setting("appsforwebsites", "Apps for websites"),
      setting("defaultapps", "Default apps"),
      setting("optionalfeatures", "Optional features"),
      setting("maps", "Offline maps"),
      setting("startupapps", "Startup apps"),
      setting("videoplayback", "Video playback"),
      setting("autoplay", "AutoPlay"),
      setting("devices", "Bluetooth & devices"),
      setting("connecteddevices", "Devices"),
      setting("camera", "Camera"),
      setting("mousetouchpad", "Mouse"),
      setting("pen", "Pen & Windows Ink"),
      setting("printers", "Printers & scanners"),
      setting("devices-touchpad", "Touchpad"),
      setting("typing", "Typing"),
      setting("usb", "USB"),
      setting("easeofaccess-audio", "Audio"),
      setting("easeofaccess-closedcaptioning", "Captions"),
      setting("easeofaccess-colorfilter", "Color filters"),
      setting("easeofaccess-eyecontrol", "Eye control"),
      setting("easeofaccess-hearingaids", "Hearing devices"),
      setting("easeofaccess-highcontrast", "Contrast themes"),
      setting("easeofaccess-keyboard", "Keyboard"),
      setting("easeofaccess-magnifier", "Magnifier"),
      setting("easeofaccess-mousepointer", "Mouse pointer and touch"),
      setting("easeofaccess-narrator", "Narrator"),
      setting("easeofaccess-speechrecognition", "Speech"),
      setting("easeofaccess-cursor", "Text cursor"),
      setting("easeofaccess-visualeffects", "Visual Effects"),
      setting("gaming-gamedvr", "Captures"),
      setting("gaming-gamebar", "Game Bar"),
      setting("gaming-gamemode", "Game Mode"),
      setting("network-status", "Network & internet"),
      setting("network-advancedsettings", "Advanced network settings"),
      setting("network-airplanemode", "Airplane mode"),
      setting("network-dialup", "Dial-up"),
      setting("network-ethernet", "Ethernet"),
      setting("network-mobilehotspot", "Mobile hotspot"),
      setting("network-proxy", "Proxy"),
      setting("network-vpn", "VPN"),
      setting("network-wifi", "Wi-Fi"),
      setting("personalization-background", "Background"),
      setting("personalization-colors", "Colors"),
      setting("personalization-lighting", "Dynamic Lighting"),
      setting("fonts", "Fonts"),
      setting("lockscreen", "Lock screen"),
      setting("personalization", "Personalization"),
      setting("personalization-start", "Start"),
      setting("taskbar", "Taskbar"),
      setting("personalization-textinput", "Text input"),
      setting("themes", "Themes"),
      setting("privacy-accountinfo", "Account info"),
      setting("privacy-activityhistory", "Activity history"),
      setting("privacy-appdiagnostics", "App diagnostics"),
      setting("privacy-automaticfiledownloads", "Automatic file downloads"),
      setting("privacy-calendar", "Calendar"),
      setting("privacy-callhistory", "Call history"),
      setting("privacy-contacts", "Contacts"),
      setting("privacy-documents", "Documents"),
      setting("privacy-downloadsfolder", "Downloads folder"),
      setting("privacy-email", "Email"),
      setting("privacy-broadfilesystemaccess", "File system"),
      setting("privacy", "Privacy & security"),
      setting("privacy-general", "Recommendations & offers"),
      setting("privacy-speechtyping", "Inking & typing personalization"),
      setting("privacy-location", "Location"),
      setting("privacy-messaging", "Messaging"),
      setting("privacy-microphone", "Microphone"),
      setting("privacy-musiclibrary", "Music Library"),
      setting("privacy-customdevices", "Other devices"),
      setting("privacy-phonecalls", "Phone calls"),
      setting("privacy-pictures", "Pictures"),
      setting("privacy-radios", "Radios"),
      setting("privacy-tasks", "Tasks"),
      setting("privacy-videos", "Videos"),
      setting("privacy-voiceactivation", "Voice activation"),
      setting("apps-volume", "Volume mixer"),
      setting("sound", "Sound"),
      setting("sound-devices", "Sound devices"),
      setting("search", "Search"),
      setting("about", "About"),
      setting("powersleep", "Power & battery"),
      setting("clipboard", "Clipboard"),
      setting("display", "Display"),
      setting("deviceencryption", "Device encryption"),
      setting("quiethours", "Focus"),
      setting("multitasking", "Multitasking"),
      setting("nightlight", "Night light"),
      setting("project", "Projecting to this PC"),
      setting("taskbar", "Taskbar"),
      setting("notifications", "Notifications"),
      setting("remotedesktop", "Remote Desktop"),
      setting("storagesense", "Storage"),
      setting("dateandtime", "Date & time"),
      setting("regionlanguage", "Language & region"),
      setting("activation", "Activation"),
      setting("findmydevice", "Find my device"),
      setting("developers", "For developers"),
      setting("recovery", "Recovery"),
      setting("troubleshoot", "Troubleshoot"),
      setting("windowsdefender", "Windows Security"),
      setting("windowsinsider", "Windows Insider Program"),
      setting("windowsupdate", "Windows Update")
    ];
    return settings;
  }
}

// src/windows/windows/window-manager.ts
import { Buffer as Buffer3 } from "node:buffer";

// src/windows/windows/constants.ts
var WM_CLOSE = 16;
var SW_MAXIMISE = 3;
var SW_MINIMISE = 6;
var SW_RESTORE = 9;
var EVENT_SYSTEM_MINIMISESTART = 22;
var WINEVENT_OUTOFCONTEXT = 0;
var PROCESS_QUERY_LIMITED_INFORMATION = 4096;
var PROCESS_VM_READ = 16;
var GW_HWNDNEXT = 2;
var GW_OWNER = 4;
var GW_CHILD = 5;

// src/windows/windows/events.ts
import koffi7 from "koffi";

// src/windows/windows/koffi-defs.ts
import koffi6 from "koffi";
var user322 = koffi6.load("user32.dll");
var gdi322 = koffi6.load("gdi32.dll");
var HANDLE = "intptr_t";
var HWND = koffi6.alias("HWND", HANDLE);
var HBITMAP = koffi6.alias("HBITMAP", HANDLE);
var HDC = koffi6.alias("HDC", HANDLE);
var HGDIOBJ = koffi6.alias("HGDIOBJ", HANDLE);
var BOOL = koffi6.alias("BOOL", "int");
var UINT = "uint";
var INT = "int";
var LPARAM = "intptr_t";
var WPARAM = "uintptr_t";
var LONG = "long";
var RECT = koffi6.struct("RECT", {
  left: LONG,
  top: LONG,
  right: LONG,
  bottom: LONG
});
var BITMAPINFO = koffi6.struct("BITMAPINFO", {
  bmiHeader: BITMAPINFOHEADER,
  bmiColors: koffi6.array("uint32", 1)
});
var WINEVENTPROC = koffi6.proto("void WINEVENTPROC(void* hWinEventHook, uint event, HWND hwnd, long idObject, long idChild, uint dwEventThread, uint dwmsEventTime)");
var WNDENUMPROC = koffi6.proto("int __stdcall WNDENUMPROC(HWND hwnd, intptr_t lParam)");
var User32 = {
  FindWindowA: user322.func("FindWindowA", HWND, ["str", "str"]),
  GetForegroundWindow: user322.func("GetForegroundWindow", HWND, []),
  SetForegroundWindow: user322.func("SetForegroundWindow", BOOL, [HWND]),
  ShowWindow: user322.func("ShowWindow", BOOL, [HWND, INT]),
  PostMessageA: user322.func("PostMessageA", BOOL, [HWND, UINT, WPARAM, LPARAM]),
  IsWindowVisible: user322.func("IsWindowVisible", BOOL, [HWND]),
  GetWindowPlacement: user322.func("GetWindowPlacement", BOOL, [HWND, "void*"]),
  SetWinEventHook: user322.func("SetWinEventHook", HANDLE, [
    UINT,
    UINT,
    "void*",
    koffi6.pointer(WINEVENTPROC),
    UINT,
    UINT,
    UINT
  ]),
  UnhookWinEvent: user322.func("UnhookWinEvent", BOOL, [HANDLE]),
  EnumWindows: user322.func("EnumWindows", BOOL, [koffi6.pointer(WNDENUMPROC), LPARAM]),
  GetWindowThreadProcessId: user322.func("GetWindowThreadProcessId", UINT, [HWND, "uint*"]),
  SetWindowPos: user322.func("SetWindowPos", BOOL, [HWND, HWND, INT, INT, INT, INT, UINT]),
  GetWindowTextA: user322.func("GetWindowTextA", INT, [HWND, "char*", INT]),
  GetWindowDC: user322.func("GetWindowDC", HDC, [HWND]),
  PrintWindow: user322.func("PrintWindow", BOOL, [HWND, HDC, UINT]),
  GetWindow: user322.func("GetWindow", HWND, [HWND, UINT]),
  GetDesktopWindow: user322.func("GetDesktopWindow", HWND, []),
  ReleaseDC: user322.func("ReleaseDC", INT, [HWND, HDC]),
  GetWindowRect: user322.func("GetWindowRect", BOOL, [HWND, koffi6.out(koffi6.pointer(RECT))])
};
var Gdi32 = {
  CreateCompatibleDC: gdi322.func("CreateCompatibleDC", HDC, [HDC]),
  CreateCompatibleBitmap: gdi322.func("CreateCompatibleBitmap", HBITMAP, [HDC, INT, INT]),
  SelectObject: gdi322.func("SelectObject", HGDIOBJ, [HDC, HGDIOBJ]),
  DeleteObject: gdi322.func("DeleteObject", BOOL, [HGDIOBJ]),
  DeleteDC: gdi322.func("DeleteDC", BOOL, [HDC]),
  GetDIBits: gdi322.func("GetDIBits", INT, [HDC, HBITMAP, UINT, UINT, "void*", koffi6.pointer(BITMAPINFO), UINT])
};
var Kernel32 = {
  OpenProcess: kernel32.func("OpenProcess", HANDLE, [UINT, BOOL, UINT]),
  CloseHandle: kernel32.func("CloseHandle", BOOL, [HANDLE]),
  QueryFullProcessImageNameA: kernel32.func("QueryFullProcessImageNameA", BOOL, [HANDLE, UINT, "char*", "uint*"])
};

// src/windows/windows/events.ts
class WindowEventListener {
  hook = null;
  lastMinimisedWindowHandle = null;
  callback = null;
  constructor() {
    this.initialize();
  }
  initialize() {
    this.callback = koffi7.register((_hWinEventHook, event, hwnd) => {
      if (event === EVENT_SYSTEM_MINIMISESTART) {
        this.lastMinimisedWindowHandle = hwnd;
      }
    }, koffi7.pointer(WINEVENTPROC));
    this.hook = User32.SetWinEventHook(EVENT_SYSTEM_MINIMISESTART, EVENT_SYSTEM_MINIMISESTART, null, this.callback, 0, 0, WINEVENT_OUTOFCONTEXT);
  }
  getLastMinimised() {
    return this.lastMinimisedWindowHandle;
  }
  setLastMinimised(hwnd) {
    this.lastMinimisedWindowHandle = hwnd;
  }
  clearLastMinimised() {
    this.lastMinimisedWindowHandle = null;
  }
  dispose() {
    if (this.hook) {
      User32.UnhookWinEvent(this.hook);
      this.hook = null;
    }
    if (this.callback) {
      koffi7.unregister(this.callback);
      this.callback = null;
    }
  }
}
var windowEventListener = new WindowEventListener;

// src/windows/windows/thumbnail.ts
import { Buffer as Buffer2 } from "node:buffer";
var DIB_RGB_COLORS2 = 0;
var PW_RENDERFULLCONTENT = 2;
var captureWindowThumbnail = (hwnd) => {
  const rect = {};
  if (!User32.GetWindowRect(hwnd, rect))
    return;
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  if (width <= 0 || height <= 0)
    return;
  const hdcWindow = User32.GetWindowDC(hwnd);
  if (!hdcWindow)
    return;
  const hdcMem = Gdi32.CreateCompatibleDC(hdcWindow);
  const hBitmap = Gdi32.CreateCompatibleBitmap(hdcWindow, width, height);
  const hOld = Gdi32.SelectObject(hdcMem, hBitmap);
  const result = User32.PrintWindow(hwnd, hdcMem, PW_RENDERFULLCONTENT);
  if (!result) {
    Gdi32.SelectObject(hdcMem, hOld);
    Gdi32.DeleteObject(hBitmap);
    Gdi32.DeleteDC(hdcMem);
    User32.ReleaseDC(hwnd, hdcWindow);
    return;
  }
  const bmi = {
    bmiHeader: {
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
    },
    bmiColors: [0]
  };
  const bufferSize = width * height * 4;
  const buffer = Buffer2.alloc(bufferSize);
  const lines = Gdi32.GetDIBits(hdcMem, hBitmap, 0, height, buffer, bmi, DIB_RGB_COLORS2);
  Gdi32.SelectObject(hdcMem, hOld);
  Gdi32.DeleteObject(hBitmap);
  Gdi32.DeleteDC(hdcMem);
  User32.ReleaseDC(hwnd, hdcWindow);
  if (lines === 0)
    return;
  const fileHeaderSize = 14;
  const infoHeaderSize = 40;
  const fileSize = fileHeaderSize + infoHeaderSize + bufferSize;
  const fileHeader = Buffer2.alloc(fileHeaderSize);
  fileHeader.write("BM", 0);
  fileHeader.writeUInt32LE(fileSize, 2);
  fileHeader.writeUInt32LE(0, 6);
  fileHeader.writeUInt32LE(fileHeaderSize + infoHeaderSize, 10);
  const infoHeader = Buffer2.alloc(infoHeaderSize);
  infoHeader.writeUInt32LE(infoHeaderSize, 0);
  infoHeader.writeInt32LE(width, 4);
  infoHeader.writeInt32LE(height, 8);
  infoHeader.writeUInt16LE(1, 12);
  infoHeader.writeUInt16LE(32, 14);
  infoHeader.writeUInt32LE(0, 16);
  infoHeader.writeUInt32LE(bufferSize, 20);
  infoHeader.writeInt32LE(0, 24);
  infoHeader.writeInt32LE(0, 28);
  infoHeader.writeUInt32LE(0, 32);
  infoHeader.writeUInt32LE(0, 36);
  const bmpBuffer = Buffer2.concat([fileHeader, infoHeader, buffer]);
  return bmpBuffer.toString("base64");
};

// src/windows/windows/window-manager.ts
class WindowsWindowManager {
  appRegistry;
  constructor(appRegistry) {
    this.appRegistry = appRegistry;
  }
  async getAllOpenWindows() {
    const windows = this.getOpenWindows();
    const foregroundWindow = this.getForegroundWindow();
    const apps = await this.appRegistry.fetchApps();
    return windows.map((window) => {
      const app = apps.find((a) => a.path?.toLowerCase() === window.application?.toLowerCase());
      return {
        id: window.id,
        title: window.title,
        app,
        isFocused: window.handle === foregroundWindow,
        getThumbnail: async () => captureWindowThumbnail(window.handle),
        focus: () => this.openWindow(window.handle),
        close: () => this.closeWindow(window.handle),
        minimize: () => this.minimiseWindow(window.handle),
        maximize: () => this.maximiseWindow(window.handle),
        restore: () => this.restoreWindow(window.handle)
      };
    });
  }
  async getActiveWindow() {
    const hwnd = this.getForegroundWindow();
    if (!hwnd)
      return;
    const titleBuffer = Buffer3.alloc(512);
    User32.GetWindowTextA(hwnd, titleBuffer, titleBuffer.length);
    const title = titleBuffer.toString("utf8").replace(/\0/g, "").trim();
    if (!title)
      return;
    const pidBuffer = Buffer3.alloc(4);
    User32.GetWindowThreadProcessId(hwnd, pidBuffer);
    const pid = pidBuffer.readUInt32LE(0);
    let application;
    const hProcess = Kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
    if (hProcess) {
      const pathBuffer = Buffer3.alloc(1024);
      const sizeBuffer = Buffer3.alloc(4);
      sizeBuffer.writeUInt32LE(pathBuffer.length, 0);
      if (Kernel32.QueryFullProcessImageNameA(hProcess, 0, pathBuffer, sizeBuffer)) {
        const len = sizeBuffer.readUInt32LE(0);
        application = pathBuffer.toString("utf8", 0, len);
      }
      Kernel32.CloseHandle(hProcess);
    }
    const apps = await this.appRegistry.fetchApps();
    const app = apps.find((a) => a.path?.toLowerCase() === application?.toLowerCase());
    return {
      id: title.toLowerCase().replace(/\s+/g, "_"),
      title,
      app,
      isFocused: true,
      getThumbnail: async () => captureWindowThumbnail(hwnd),
      focus: () => this.openWindow(hwnd),
      close: () => this.closeWindow(hwnd),
      minimize: () => this.minimiseWindow(hwnd),
      maximize: () => this.maximiseWindow(hwnd),
      restore: () => this.restoreWindow(hwnd)
    };
  }
  findWindowByTitle(title) {
    return User32.FindWindowA(null, title);
  }
  getForegroundWindow() {
    return User32.GetForegroundWindow();
  }
  closeWindow(handleOrTitle) {
    const hwnd = typeof handleOrTitle === "string" ? this.findWindowByTitle(handleOrTitle) : handleOrTitle;
    if (!hwnd)
      return false;
    return User32.PostMessageA(hwnd, WM_CLOSE, 0, 0);
  }
  restoreWindow(handleOrTitle) {
    const hwnd = typeof handleOrTitle === "string" ? this.findWindowByTitle(handleOrTitle) : handleOrTitle;
    if (!hwnd)
      return false;
    return User32.ShowWindow(hwnd, SW_RESTORE);
  }
  minimiseWindow(handleOrTitle) {
    const hwnd = typeof handleOrTitle === "string" ? this.findWindowByTitle(handleOrTitle) : handleOrTitle;
    if (!hwnd)
      return false;
    const result = User32.ShowWindow(hwnd, SW_MINIMISE);
    if (result) {
      windowEventListener.setLastMinimised(hwnd);
    }
    return result;
  }
  maximiseWindow(handleOrTitle) {
    const hwnd = typeof handleOrTitle === "string" ? this.findWindowByTitle(handleOrTitle) : handleOrTitle;
    if (!hwnd)
      return false;
    return User32.ShowWindow(hwnd, SW_MAXIMISE);
  }
  restoreLastMinimised() {
    const hwnd = windowEventListener.getLastMinimised();
    if (!hwnd)
      return false;
    User32.ShowWindow(hwnd, SW_RESTORE);
    User32.SetForegroundWindow(hwnd);
    windowEventListener.clearLastMinimised();
    return true;
  }
  openWindow(hwnd) {
    if (!hwnd)
      return false;
    const foreground = User32.GetForegroundWindow();
    const isVisible = User32.IsWindowVisible(hwnd);
    const placement = Buffer3.alloc(44);
    User32.GetWindowPlacement(hwnd, placement);
    const showCmd = placement.readUInt32LE(8);
    const isMinimised = showCmd === 2;
    if (isVisible && !isMinimised && foreground === hwnd) {
      return true;
    }
    if (isVisible && !isMinimised) {
      User32.SetForegroundWindow(hwnd);
      return true;
    }
    User32.ShowWindow(hwnd, SW_RESTORE);
    User32.SetForegroundWindow(hwnd);
    return true;
  }
  getWindowsByApp(appPath) {
    const windows = [];
    const targetPath = appPath.toLowerCase();
    let hwnd = User32.GetDesktopWindow();
    hwnd = User32.GetWindow(hwnd, GW_CHILD);
    while (hwnd) {
      if (User32.IsWindowVisible(hwnd)) {
        const pidBuffer = Buffer3.alloc(4);
        User32.GetWindowThreadProcessId(hwnd, pidBuffer);
        const pid = pidBuffer.readUInt32LE(0);
        const hProcess = Kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, 0, pid);
        if (hProcess) {
          const pathBuffer = Buffer3.alloc(1024);
          const sizeBuffer = Buffer3.alloc(4);
          sizeBuffer.writeUInt32LE(pathBuffer.length, 0);
          if (Kernel32.QueryFullProcessImageNameA(hProcess, 0, pathBuffer, sizeBuffer)) {
            const len = sizeBuffer.readUInt32LE(0);
            const path = pathBuffer.toString("utf8", 0, len).toLowerCase();
            if (path === targetPath) {
              windows.push(hwnd);
            }
          }
          Kernel32.CloseHandle(hProcess);
        }
      }
      hwnd = User32.GetWindow(hwnd, GW_HWNDNEXT);
    }
    return windows;
  }
  getOpenWindows() {
    const windows = [];
    const pidMap = new Map;
    let hwnd = User32.GetDesktopWindow();
    hwnd = User32.GetWindow(hwnd, GW_CHILD);
    while (hwnd) {
      if (!User32.GetWindow(hwnd, GW_OWNER) && User32.IsWindowVisible(hwnd)) {
        const titleBuffer = Buffer3.alloc(512);
        User32.GetWindowTextA(hwnd, titleBuffer, titleBuffer.length);
        const title = titleBuffer.toString("utf8").replace(/\0/g, "").trim();
        if (title && title !== "Prompt-ly") {
          const pidBuffer = Buffer3.alloc(4);
          User32.GetWindowThreadProcessId(hwnd, pidBuffer);
          const pid = pidBuffer.readUInt32LE(0);
          let application;
          if (pidMap.has(pid)) {
            application = pidMap.get(pid);
          } else {
            const hProcess = Kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if (hProcess) {
              const pathBuffer = Buffer3.alloc(1024);
              const sizeBuffer = Buffer3.alloc(4);
              sizeBuffer.writeUInt32LE(pathBuffer.length, 0);
              if (Kernel32.QueryFullProcessImageNameA(hProcess, 0, pathBuffer, sizeBuffer)) {
                const len = sizeBuffer.readUInt32LE(0);
                application = pathBuffer.toString("utf8", 0, len);
                pidMap.set(pid, application);
              }
              Kernel32.CloseHandle(hProcess);
            }
          }
          windows.push({
            id: title.toLowerCase().replace(/\s+/g, "_"),
            title,
            application,
            processId: pid,
            handle: hwnd
          });
        }
      }
      hwnd = User32.GetWindow(hwnd, GW_HWNDNEXT);
    }
    return windows;
  }
}

// src/windows/windows.ts
var Process = new WindowsProcessManager;
var appRegistry = new WindowsAppRegistry;
var Apps = appRegistry;
var Settings = new WindowsSettingRegistry;
var Windows = new WindowsWindowManager(appRegistry);
appRegistry.setWindowManager(Windows);
export {
  exports_windows as Windows
};
