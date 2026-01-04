import type { AppRegistry } from "@/modules/apps";
import type { ProcessManager } from "@/modules/process";
import type { SettingRegistry } from "@/modules/settings";
import type { WindowManager } from "@/modules/windows";
import { WindowsAppRegistry } from "./apps/apps";
import { WindowsProcessManager } from "./process/process";
import { WindowsSettingRegistry } from "./settings/settings";
import { WindowsWindowManager } from "./windows/window-manager";

export const Process: ProcessManager = new WindowsProcessManager();
const appRegistry = new WindowsAppRegistry();
export const Apps: AppRegistry = appRegistry;
export const Settings: SettingRegistry = new WindowsSettingRegistry();
export const Windows: WindowManager = new WindowsWindowManager(appRegistry);

appRegistry.setWindowManager(Windows);
