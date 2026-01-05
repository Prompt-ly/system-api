import type { App } from "./apps";

export interface Window {
  id: string;
  title: string;
  app?: App;
  isFocused: boolean;
  getThumbnail: () => Promise<string | undefined>;
  focus: () => void;
  close: () => void;
  minimize: () => void;
  maximize: () => void;
  restore: () => void;
}

export interface WindowManager {
  getAllOpenWindows(): Promise<Window[]>;
  getActiveWindow(): Promise<Window | undefined>;
}
