import type { AppRegistry } from "../../modules/apps";
import type { Window, WindowManager } from "../../modules/windows";
import type { NativeHandle, WindowInfo } from "./types";
import { Buffer } from "node:buffer";
import {
  GW_CHILD,
  GW_HWNDNEXT,
  GW_OWNER,
  PROCESS_QUERY_LIMITED_INFORMATION,
  PROCESS_VM_READ,
  SW_MAXIMISE,
  SW_MINIMISE,
  SW_RESTORE,
  WM_CLOSE
} from "./constants";
import { windowEventListener } from "./events";
import { Kernel32, User32 } from "./koffi-defs";
import { captureWindowThumbnail } from "./thumbnail";

export class WindowsWindowManager implements WindowManager {
  constructor(private appRegistry: AppRegistry) {}

  async getAllOpenWindows(): Promise<Window[]> {
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

  async getActiveWindow(): Promise<Window | undefined> {
    const hwnd = this.getForegroundWindow();
    if (!hwnd) return undefined;

    const titleBuffer = Buffer.alloc(512);
    User32.GetWindowTextA(hwnd, titleBuffer, titleBuffer.length);
    const title = titleBuffer.toString("utf8").replace(/\0/g, "").trim();

    if (!title) return undefined;

    const pidBuffer = Buffer.alloc(4);
    User32.GetWindowThreadProcessId(hwnd, pidBuffer);
    const pid = pidBuffer.readUInt32LE(0);

    let application: string | undefined;
    const hProcess = Kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);

    if (hProcess) {
      const pathBuffer = Buffer.alloc(1024);
      const sizeBuffer = Buffer.alloc(4);
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

  findWindowByTitle(title: string): NativeHandle {
    return User32.FindWindowA(null, title);
  }

  getForegroundWindow(): NativeHandle {
    return User32.GetForegroundWindow();
  }

  closeWindow(handleOrTitle: NativeHandle | string): boolean {
    const hwnd = typeof handleOrTitle === "string" ? this.findWindowByTitle(handleOrTitle) : handleOrTitle;
    if (!hwnd) return false;
    return User32.PostMessageA(hwnd, WM_CLOSE, 0, 0);
  }

  restoreWindow(handleOrTitle: NativeHandle | string): boolean {
    const hwnd = typeof handleOrTitle === "string" ? this.findWindowByTitle(handleOrTitle) : handleOrTitle;
    if (!hwnd) return false;
    return User32.ShowWindow(hwnd, SW_RESTORE);
  }

  minimiseWindow(handleOrTitle: NativeHandle | string): boolean {
    const hwnd = typeof handleOrTitle === "string" ? this.findWindowByTitle(handleOrTitle) : handleOrTitle;
    if (!hwnd) return false;

    const result = User32.ShowWindow(hwnd, SW_MINIMISE);
    if (result) {
      windowEventListener.setLastMinimised(hwnd);
    }
    return result;
  }

  maximiseWindow(handleOrTitle: NativeHandle | string): boolean {
    const hwnd = typeof handleOrTitle === "string" ? this.findWindowByTitle(handleOrTitle) : handleOrTitle;
    if (!hwnd) return false;
    return User32.ShowWindow(hwnd, SW_MAXIMISE);
  }

  restoreLastMinimised(): boolean {
    const hwnd = windowEventListener.getLastMinimised();
    if (!hwnd) return false;

    User32.ShowWindow(hwnd, SW_RESTORE);
    User32.SetForegroundWindow(hwnd);
    windowEventListener.clearLastMinimised();
    return true;
  }

  openWindow(hwnd: NativeHandle): boolean {
    if (!hwnd) return false;

    const foreground = User32.GetForegroundWindow();
    const isVisible = User32.IsWindowVisible(hwnd);

    // Check if minimised
    const placement = Buffer.alloc(44);
    User32.GetWindowPlacement(hwnd, placement);
    const showCmd = placement.readUInt32LE(8);
    const isMinimised = showCmd === 2; // SW_SHOWMINIMIZED

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

  getWindowsByApp(appPath: string): NativeHandle[] {
    const windows: NativeHandle[] = [];
    const targetPath = appPath.toLowerCase();

    let hwnd = User32.GetDesktopWindow();
    hwnd = User32.GetWindow(hwnd, GW_CHILD);

    while (hwnd) {
      if (User32.IsWindowVisible(hwnd)) {
        const pidBuffer = Buffer.alloc(4);
        User32.GetWindowThreadProcessId(hwnd, pidBuffer);
        const pid = pidBuffer.readUInt32LE(0);

        const hProcess = Kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, 0, pid);

        if (hProcess) {
          const pathBuffer = Buffer.alloc(1024);
          const sizeBuffer = Buffer.alloc(4);
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

  getOpenWindows(): WindowInfo[] {
    const windows: WindowInfo[] = [];
    const pidMap = new Map<number, string>();

    let hwnd = User32.GetDesktopWindow();
    hwnd = User32.GetWindow(hwnd, GW_CHILD);

    while (hwnd) {
      // Filter owned windows
      if (!User32.GetWindow(hwnd, GW_OWNER) && User32.IsWindowVisible(hwnd)) {
        const titleBuffer = Buffer.alloc(512);
        User32.GetWindowTextA(hwnd, titleBuffer, titleBuffer.length);
        const title = titleBuffer.toString("utf8").replace(/\0/g, "").trim();

        if (title && title !== "Prompt-ly") {
          const pidBuffer = Buffer.alloc(4);
          User32.GetWindowThreadProcessId(hwnd, pidBuffer);
          const pid = pidBuffer.readUInt32LE(0);

          let application: string | undefined;

          if (pidMap.has(pid)) {
            application = pidMap.get(pid);
          } else {
            const hProcess = Kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);

            if (hProcess) {
              const pathBuffer = Buffer.alloc(1024);
              const sizeBuffer = Buffer.alloc(4);
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
