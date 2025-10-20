import type { App, AppRegistry } from "@/modules/apps";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractIconAsBase64 } from "./icon-extractor";
import { ShellExecuteW, SW_SHOW } from "./koffi-defs";

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
  async fetchApps(): Promise<App[]> {
    const apps = await runFetchAppsScript();

    return apps.map(app => ({
      id: app.id,
      name: app.name,
      type: app.type,
      icon: {
        path: app.icon,
        getBase64: async () => (await extractIconAsBase64(app.icon)) ?? ""
      },
      launch: () => {
        if (app.type === "uwp") {
          execFileAsync("powershell.exe", [
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-Command",
            `Start-Process "shell:AppsFolder\\${app.launch}"`
          ], { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 * 128 });
        } else {
          const wide = Buffer.from(`${app.launch}\0`, "utf16le");
          ShellExecuteW(null, null, wide, null, null, SW_SHOW);
        }
      }
    }));
  }
}
