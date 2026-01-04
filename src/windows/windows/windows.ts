import type { NativeHandle } from "./types";
import { WindowsAppRegistry } from "../apps/apps";
import * as Constants from "./constants";
import { windowEventListener } from "./events";
import { Kernel32, User32 } from "./koffi-defs";
import { WindowsWindowManager } from "./window-manager";

const WindowManager = new WindowsWindowManager(new WindowsAppRegistry());

export const Windows = {
  // Expose constants and low-level functions if needed, or keep them internal
  Constants,
  Native: { User32, Kernel32 },

  // Window Finding
  find(title: string) {
    return WindowManager.findWindowByTitle(title);
  },

  getForeground() {
    return WindowManager.getForegroundWindow();
  },

  getByApp(appPath: string) {
    return WindowManager.getWindowsByApp(appPath);
  },

  getAllOpen() {
    return WindowManager.getOpenWindows();
  },

  // Window Actions
  close(handleOrTitle: NativeHandle | string) {
    return WindowManager.closeWindow(handleOrTitle);
  },

  closeActive() {
    const hwnd = WindowManager.getForegroundWindow();
    return WindowManager.closeWindow(hwnd);
  },

  restore(handleOrTitle: NativeHandle | string) {
    return WindowManager.restoreWindow(handleOrTitle);
  },

  restoreLastMinimised() {
    return WindowManager.restoreLastMinimised();
  },

  minimise(handleOrTitle: NativeHandle | string) {
    return WindowManager.minimiseWindow(handleOrTitle);
  },

  minimiseActive() {
    const hwnd = WindowManager.getForegroundWindow();
    return WindowManager.minimiseWindow(hwnd);
  },

  maximise(handleOrTitle: NativeHandle | string) {
    return WindowManager.maximiseWindow(handleOrTitle);
  },

  maximiseActive() {
    const hwnd = WindowManager.getForegroundWindow();
    return WindowManager.maximiseWindow(hwnd);
  },

  open(handle: NativeHandle) {
    return WindowManager.openWindow(handle);
  },

  // State
  get lastMinimisedHandle() {
    return windowEventListener.getLastMinimised();
  },

  cleanup() {
    windowEventListener.dispose();
  }
};

export default Windows;
