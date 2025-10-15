import koffi from "koffi";

const shell32 = koffi.load("shell32.dll");
const user32 = koffi.load("user32.dll");
const gdi32 = koffi.load("gdi32.dll");

export const SHFILEINFOW = koffi.struct("SHFILEINFOW", {
  hIcon: "void*",
  iIcon: "int",
  dwAttributes: "uint32",
  szDisplayName: koffi.array("uint16", 260),
  szTypeName: koffi.array("uint16", 80)
});

export const BITMAPINFOHEADER = koffi.struct("BITMAPINFOHEADER", {
  biSize: "uint32",
  biWidth: "int32",
  biHeight: "int32",
  biPlanes: "uint16",
  biBitCount: "uint16",
  biCompression: "uint32",
  biSizeImage: "uint32",
  biXPelsPerMeter: "int32",
  biYPelsPerMeter: "int32",
  biClrUsed: "uint32",
  biClrImportant: "uint32"
});

export const BITMAP = koffi.struct("BITMAP", {
  bmType: "int32",
  bmWidth: "int32",
  bmHeight: "int32",
  bmWidthBytes: "int32",
  bmPlanes: "uint16",
  bmBitsPixel: "uint16",
  bmBits: "void*"
});

const IconInfoStruct = koffi.struct({
  fIcon: "bool",
  xHotspot: "uint32",
  yHotspot: "uint32",
  hbmMask: "void*",
  hbmColor: "void*"
});

export const SHGetFileInfoW = shell32.func("SHGetFileInfoW", "uintptr_t", [
  koffi.pointer("uint16"),
  "uint32",
  koffi.out(koffi.pointer(SHFILEINFOW)),
  "uint32",
  "uint32"
]);

export const ExtractIconExW = shell32.func("ExtractIconExW", "uint32", [
  koffi.pointer("uint16"),
  "int",
  koffi.out(koffi.pointer("void*")),
  koffi.out(koffi.pointer("void*")),
  "uint32"
]);

export const DestroyIcon = user32.func("DestroyIcon", "bool", ["void*"]);
export const GetIconInfo = user32.func("GetIconInfo", "bool", ["void*", koffi.out(koffi.pointer(IconInfoStruct))]);
export const GetDIBits = gdi32.func("GetDIBits", "int", [
  "void*",
  "void*",
  "uint32",
  "uint32",
  koffi.out("void*"),
  koffi.out(koffi.pointer("void")),
  "uint32"
]);
export const GetDC = user32.func("GetDC", "void*", ["void*"]);
export const ReleaseDC = user32.func("ReleaseDC", "int", ["void*", "void*"]);
export const DeleteObject = gdi32.func("DeleteObject", "bool", ["void*"]);
export const GetObject = gdi32.func("GetObjectW", "int", ["void*", "int", koffi.out(koffi.pointer("void"))]);

export const SHGFI_ICON = 0x000000100;
export const SHGFI_SMALLICON = 0x000000001;
export const DIB_RGB_COLORS = 0;
