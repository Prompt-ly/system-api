import type { AppRegistry } from "@/modules/apps";
import type { ProcessManager } from "@/modules/process";
import { WindowsAppRegistry } from "./apps/apps";
import { WindowsProcessManager } from "./process/process";

export const Process: ProcessManager = new WindowsProcessManager();
export const Apps: AppRegistry = new WindowsAppRegistry();

// Export createAppIcon function for direct usage if needed
export { createAppIcon } from "./apps/app-icon";
