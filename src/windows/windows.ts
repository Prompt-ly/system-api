import type { AppRegistry } from "@/modules/apps";
import type { ProcessManager } from "@/modules/process";
import type { SettingRegistry } from "@/modules/settings";
import { WindowsAppRegistry } from "./apps/apps";
import { WindowsProcessManager } from "./process/process";
import { WindowsSettingRegistry } from "./settings/settings";

export const Process: ProcessManager = new WindowsProcessManager();
export const Apps: AppRegistry = new WindowsAppRegistry();
export const Settings: SettingRegistry = new WindowsSettingRegistry();
