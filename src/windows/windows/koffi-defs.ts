import koffi from "koffi";
import { BITMAPINFOHEADER, kernel32 } from "../../utils/koffi-globals";

const user32 = koffi.load("user32.dll");
const gdi32 = koffi.load("gdi32.dll");

// Types
const HANDLE = "intptr_t"; // Use intptr_t for handles to avoid object wrapping issues
const HWND = koffi.alias("HWND", HANDLE);
const HBITMAP = koffi.alias("HBITMAP", HANDLE);
const HDC = koffi.alias("HDC", HANDLE);
const HGDIOBJ = koffi.alias("HGDIOBJ", HANDLE);
const BOOL = koffi.alias("BOOL", "int"); // bool is often int in C
const UINT = "uint";
const INT = "int";
const LPARAM = "intptr_t";
const WPARAM = "uintptr_t";
const LONG = "long";
const WORD = "uint16";
const DWORD = "uint32";

// Structs
export const RECT = koffi.struct("RECT", {
  left: LONG,
  top: LONG,
  right: LONG,
  bottom: LONG
});

export { BITMAPINFOHEADER };

export const BITMAPINFO = koffi.struct("BITMAPINFO", {
  bmiHeader: BITMAPINFOHEADER,
  bmiColors: koffi.array("uint32", 1) // We only use this for RGB, so 1 is fine or even 0 if we handle pointer math
});

// Callbacks
export const WINEVENTPROC = koffi.proto(
  "void WINEVENTPROC(void* hWinEventHook, uint event, HWND hwnd, long idObject, long idChild, uint dwEventThread, uint dwmsEventTime)"
);

export const WNDENUMPROC = koffi.proto("int __stdcall WNDENUMPROC(HWND hwnd, intptr_t lParam)");

// User32 Functions
export const User32 = {
  FindWindowA: user32.func("FindWindowA", HWND, ["str", "str"]),
  GetForegroundWindow: user32.func("GetForegroundWindow", HWND, []),
  SetForegroundWindow: user32.func("SetForegroundWindow", BOOL, [HWND]),
  ShowWindow: user32.func("ShowWindow", BOOL, [HWND, INT]),
  PostMessageA: user32.func("PostMessageA", BOOL, [HWND, UINT, WPARAM, LPARAM]),
  IsWindowVisible: user32.func("IsWindowVisible", BOOL, [HWND]),
  GetWindowPlacement: user32.func("GetWindowPlacement", BOOL, [HWND, "void*"]), // passing struct pointer as void* for now or define struct
  SetWinEventHook: user32.func("SetWinEventHook", HANDLE, [
    UINT,
    UINT,
    "void*",
    koffi.pointer(WINEVENTPROC),
    UINT,
    UINT,
    UINT
  ]),
  UnhookWinEvent: user32.func("UnhookWinEvent", BOOL, [HANDLE]),
  EnumWindows: user32.func("EnumWindows", BOOL, [koffi.pointer(WNDENUMPROC), LPARAM]),
  GetWindowThreadProcessId: user32.func("GetWindowThreadProcessId", UINT, [HWND, "uint*"]),
  SetWindowPos: user32.func("SetWindowPos", BOOL, [HWND, HWND, INT, INT, INT, INT, UINT]),
  GetWindowTextA: user32.func("GetWindowTextA", INT, [HWND, "char*", INT]),
  GetWindowDC: user32.func("GetWindowDC", HDC, [HWND]),
  PrintWindow: user32.func("PrintWindow", BOOL, [HWND, HDC, UINT]),
  GetWindow: user32.func("GetWindow", HWND, [HWND, UINT]),
  GetDesktopWindow: user32.func("GetDesktopWindow", HWND, []),
  ReleaseDC: user32.func("ReleaseDC", INT, [HWND, HDC]),
  GetWindowRect: user32.func("GetWindowRect", BOOL, [HWND, koffi.out(koffi.pointer(RECT))])
};

// GDI32 Functions
export const Gdi32 = {
  CreateCompatibleDC: gdi32.func("CreateCompatibleDC", HDC, [HDC]),
  CreateCompatibleBitmap: gdi32.func("CreateCompatibleBitmap", HBITMAP, [HDC, INT, INT]),
  SelectObject: gdi32.func("SelectObject", HGDIOBJ, [HDC, HGDIOBJ]),
  DeleteObject: gdi32.func("DeleteObject", BOOL, [HGDIOBJ]),
  DeleteDC: gdi32.func("DeleteDC", BOOL, [HDC]),
  GetDIBits: gdi32.func("GetDIBits", INT, [HDC, HBITMAP, UINT, UINT, "void*", koffi.pointer(BITMAPINFO), UINT])
};

// Kernel32 Functions (extending what might be in globals or defining new ones)
export const Kernel32 = {
  OpenProcess: kernel32.func("OpenProcess", HANDLE, [UINT, BOOL, UINT]),
  CloseHandle: kernel32.func("CloseHandle", BOOL, [HANDLE]),
  QueryFullProcessImageNameA: kernel32.func("QueryFullProcessImageNameA", BOOL, [HANDLE, UINT, "char*", "uint*"])
};
