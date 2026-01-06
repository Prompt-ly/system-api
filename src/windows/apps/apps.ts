import type { App, AppRegistry } from "@/modules/apps";
import type { WindowManager } from "@/modules/windows";
import { execFile, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { extractIconAsBase64 } from "./icon-extractor";

const execFileAsync = promisify(execFile);

type PSApp = {
  id: string;
  name: string;
  type: "desktop" | "uwp" | "url";
  icon: string;
  launch: string;
};

const runFetchAppsScript = async (): Promise<PSApp[]> => {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const scriptPath = join(thisDir, "fetch-apps.ps1");

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
    { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 * 128 }
  );

  const raw = stdout.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PSApp[]) : parsed ? [parsed as PSApp] : [];
  } catch {
    return [];
  }
};

export class WindowsAppRegistry implements AppRegistry {
  private windowManager?: WindowManager;
  private cachedApps: App[] | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  setWindowManager(wm: WindowManager) {
    this.windowManager = wm;
  }

  async fetchApps(): Promise<App[]> {
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
        getBase64: async () => (await extractIconAsBase64(app.icon)) ?? ""
      },
      open: async (newWindow?: boolean) => {
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
          execFileAsync(
            "powershell.exe",
            ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `Start-Process "shell:AppsFolder\\${app.launch}"`],
            { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 * 128 }
          );
        } else {
          spawn(app.launch, [], { detached: true, stdio: "ignore" });
        }
      },
      getOpenWindows: async () => {
        if (!this.windowManager) return [];
        const windows = await this.windowManager.getAllOpenWindows();
        return windows.filter((w) => w.app?.id === app.id);
      }
    }));

    this.lastFetchTime = Date.now();
    return this.cachedApps;
  }
}
