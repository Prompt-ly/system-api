import type { Window } from "./windows";

export interface App {
  id: string;
  name: string;
  path?: string;
  type: "desktop" | "uwp" | "url";
  icon: {
    path: string;
    getBase64: () => Promise<string>;
  };
  open: (newWindow?: boolean) => void;
  getOpenWindows?: () => Promise<Window[]>;
}

export interface AppRegistry {
  fetchApps(): Promise<App[]>;
}
