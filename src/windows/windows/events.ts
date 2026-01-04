import type { NativeHandle } from "./types";
import koffi from "koffi";
import { EVENT_SYSTEM_MINIMISESTART, WINEVENT_OUTOFCONTEXT } from "./constants";
import { User32, WINEVENTPROC } from "./koffi-defs";

class WindowEventListener {
  private hook: NativeHandle | null = null;
  private lastMinimisedWindowHandle: NativeHandle | null = null;
  private callback: NativeHandle | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.callback = koffi.register((_hWinEventHook: NativeHandle, event: number, hwnd: NativeHandle) => {
      if (event === EVENT_SYSTEM_MINIMISESTART) {
        this.lastMinimisedWindowHandle = hwnd;
      }
    }, koffi.pointer(WINEVENTPROC));

    this.hook = User32.SetWinEventHook(
      EVENT_SYSTEM_MINIMISESTART,
      EVENT_SYSTEM_MINIMISESTART,
      null,
      this.callback,
      0,
      0,
      WINEVENT_OUTOFCONTEXT
    );
  }

  public getLastMinimised(): NativeHandle | null {
    return this.lastMinimisedWindowHandle;
  }

  public setLastMinimised(hwnd: NativeHandle) {
    this.lastMinimisedWindowHandle = hwnd;
  }

  public clearLastMinimised() {
    this.lastMinimisedWindowHandle = null;
  }

  public dispose() {
    if (this.hook) {
      User32.UnhookWinEvent(this.hook);
      this.hook = null;
    }
    if (this.callback) {
      // biome-ignore lint/suspicious/noExplicitAny: koffi callback
      koffi.unregister(this.callback as any);
      this.callback = null;
    }
  }
}

export const windowEventListener = new WindowEventListener();
