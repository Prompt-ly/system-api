import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import koffi from "koffi";
import {
  BITMAPINFOHEADER,
  DeleteObject,
  DestroyIcon,
  DIB_RGB_COLORS,
  ExtractIconExW,
  GetDC,
  GetDIBits,
  GetIconInfo,
  ReleaseDC,
  SHFILEINFOW,
  SHGetFileInfoW,
  SHGFI_ICON,
  SHGFI_SMALLICON
} from "./koffi-defs";

const PREFERRED_SCALES = [32, 48, 64, 96, 100, 125, 150, 200, 400];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".svg"];
const EXECUTABLE_EXTENSIONS = [".exe", ".dll", ".cpl", ".ocx", ".scr"];
const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const toWide = (s: string): Uint16Array => {
  const arr = new Uint16Array(s.length + 1);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
};

const getMime = (ext: string) => MIME_TYPES[ext.toLowerCase()] || "image/png";

const getPatterns = (base: string, ext: string, scale: number) => [
  `${base}.scale-${scale}${ext}`,
  `${base}.targetsize-${scale}${ext}`,
  `${base}.contrast-standard_scale-${scale}${ext}`,
  `${base}.${scale}${ext}`,
  `${base}_${scale}${ext}`,
  `${base}-${scale}${ext}`
];

type IconInfo = {
  fIcon: boolean;
  xHotspot: number;
  yHotspot: number;
  hbmMask: unknown;
  hbmColor: unknown;
};

async function iconToBase64(hIcon: unknown): Promise<string | null> {
  if (!hIcon || hIcon === 0) return null;

  try {
    const iconInfo = {} as IconInfo;
    if (!GetIconInfo(hIcon, iconInfo)) {
      DestroyIcon(hIcon);
      return null;
    }

    const hdc = GetDC(null);
    if (!hdc) {
      DestroyIcon(hIcon);
      return null;
    }

    const bmi = Buffer.alloc(1024);
    const bmiHeader = {
      biSize: 40,
      biWidth: 32,
      biHeight: 32,
      biPlanes: 1,
      biBitCount: 32,
      biCompression: 0,
      biSizeImage: 0,
      biXPelsPerMeter: 0,
      biYPelsPerMeter: 0,
      biClrUsed: 0,
      biClrImportant: 0
    };

    const bufferSize = 32 * 32 * 4;
    const pixelData = Buffer.alloc(bufferSize);

    koffi.encode(bmi, BITMAPINFOHEADER, bmiHeader);

    const result = GetDIBits(hdc, iconInfo.hbmColor, 0, 32, pixelData, bmi, DIB_RGB_COLORS);

    ReleaseDC(null, hdc);
    DeleteObject(iconInfo.hbmMask);
    DeleteObject(iconInfo.hbmColor);
    DestroyIcon(hIcon);

    if (result === 0) {
      return null;
    }

    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0);
    icoHeader.writeUInt16LE(1, 2);
    icoHeader.writeUInt16LE(1, 4);

    const icoEntry = Buffer.alloc(16);
    icoEntry.writeUInt8(32, 0);
    icoEntry.writeUInt8(32, 1);
    icoEntry.writeUInt8(0, 2);
    icoEntry.writeUInt8(0, 3);
    icoEntry.writeUInt16LE(1, 4);
    icoEntry.writeUInt16LE(32, 6);
    icoEntry.writeUInt32LE(pixelData.length + 40, 8);
    icoEntry.writeUInt32LE(22, 12);

    const icoBitmapInfo = Buffer.alloc(40);
    icoBitmapInfo.writeUInt32LE(40, 0);
    icoBitmapInfo.writeInt32LE(32, 4);
    icoBitmapInfo.writeInt32LE(64, 8);
    icoBitmapInfo.writeUInt16LE(1, 12);
    icoBitmapInfo.writeUInt16LE(32, 14);
    icoBitmapInfo.writeUInt32LE(0, 16);
    icoBitmapInfo.writeUInt32LE(pixelData.length, 20);
    icoBitmapInfo.writeInt32LE(0, 24);
    icoBitmapInfo.writeInt32LE(0, 28);
    icoBitmapInfo.writeUInt32LE(0, 32);
    icoBitmapInfo.writeUInt32LE(0, 36);

    const icoFile = Buffer.concat([icoHeader, icoEntry, icoBitmapInfo, pixelData]);
    const base64 = icoFile.toString("base64");

    return `data:image/x-icon;base64,${base64}`;
  } catch {
    return null;
  }
}

async function extractIconWithKoffi(filePath: string): Promise<string | null> {
  try {
    const wideFilePath = toWide(filePath);
    const largeIconPtr = [0];
    const smallIconPtr = [0];

    const count = ExtractIconExW(wideFilePath, 0, largeIconPtr, smallIconPtr, 1);

    if (count > 0 && smallIconPtr[0]) {
      const iconData = await iconToBase64(smallIconPtr[0]);
      if (iconData) return iconData;
    }

    if (count > 0 && largeIconPtr[0]) {
      const iconData = await iconToBase64(largeIconPtr[0]);
      if (iconData) return iconData;
    }

    const fileInfo = {} as {
      hIcon: unknown;
      iIcon: number;
      dwAttributes: number;
      szDisplayName: Uint16Array;
      szTypeName: Uint16Array;
    };
    const wideFilePathForShell = toWide(filePath);
    const result = SHGetFileInfoW(
      wideFilePathForShell,
      0,
      fileInfo,
      koffi.sizeof(SHFILEINFOW),
      SHGFI_ICON | SHGFI_SMALLICON
    );

    if (result && fileInfo.hIcon) {
      return await iconToBase64(fileInfo.hIcon);
    }

    return null;
  } catch {
    return null;
  }
}

async function resolveAppxIconPathDirect(iconPath: string): Promise<string | null> {
  try {
    if (existsSync(iconPath)) return iconPath;

    const dir = dirname(iconPath);
    const baseNameWithoutExt = basename(iconPath, extname(iconPath));
    const ext = extname(iconPath);

    if (!existsSync(dir)) return null;

    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      for (const scale of PREFERRED_SCALES.slice(0, 5)) {
        for (const pattern of getPatterns(baseNameWithoutExt, ext, scale).slice(0, 3)) {
          const testPath = join(dir, pattern);
          if (existsSync(testPath)) return testPath;
        }
      }
      return null;
    }

    for (const scale of PREFERRED_SCALES) {
      for (const pattern of getPatterns(baseNameWithoutExt, ext, scale)) {
        if (files.includes(pattern)) return join(dir, pattern);
      }
    }

    const matchingFile = files.find((f) => f.startsWith(baseNameWithoutExt) && f.endsWith(ext));
    return matchingFile ? join(dir, matchingFile) : null;
  } catch {
    return null;
  }
}

async function resolveAppxIconPath(iconPath: string): Promise<string | null> {
  if (iconPath.includes("WindowsApps")) {
    return await resolveAppxIconPathDirect(iconPath);
  }

  try {
    if (existsSync(iconPath)) {
      return iconPath;
    }

    const dir = dirname(iconPath);
    const baseNameWithoutExt = basename(iconPath, extname(iconPath));
    const ext = extname(iconPath);

    if (!existsSync(dir)) {
      return null;
    }

    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      for (const scale of PREFERRED_SCALES.slice(0, 5)) {
        for (const pattern of getPatterns(baseNameWithoutExt, ext, scale).slice(0, 3)) {
          const testPath = join(dir, pattern);
          if (existsSync(testPath)) {
            return testPath;
          }
        }
      }
      return null;
    }

    for (const scale of PREFERRED_SCALES) {
      for (const pattern of getPatterns(baseNameWithoutExt, ext, scale)) {
        if (files.includes(pattern)) {
          return join(dir, pattern);
        }
      }
    }

    const matchingFile = files.find((file) => file.startsWith(baseNameWithoutExt) && file.endsWith(ext));
    return matchingFile ? join(dir, matchingFile) : null;
  } catch {
    return null;
  }
}

async function extractIcon(filePath: string): Promise<string | null> {
  if (extname(filePath).toLowerCase() === ".ico") {
    return null;
  }

  return await extractIconWithKoffi(filePath);
}

async function fileToBase64DataURI(filePath: string): Promise<string | null> {
  try {
    const resolvedPath = await resolveAppxIconPath(filePath);
    if (!resolvedPath) return null;

    const buffer = await readFile(resolvedPath);
    const ext = extname(resolvedPath);
    const mimeType = getMime(ext);
    const base64 = buffer.toString("base64");

    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function extractIconAsBase64(filePath: string | undefined | null): Promise<string | null> {
  if (!filePath || !filePath.trim()) {
    return null;
  }

  const cleanPath = filePath.trim();
  const ext = extname(cleanPath).toLowerCase();
  const isWindowsApps = cleanPath.includes("WindowsApps");

  if (!isWindowsApps && !existsSync(cleanPath)) {
    return null;
  }

  if (IMAGE_EXTENSIONS.includes(ext) || ext === ".ico") {
    return await fileToBase64DataURI(cleanPath);
  }

  if (EXECUTABLE_EXTENSIONS.includes(ext)) {
    return await extractIcon(cleanPath);
  }

  return await extractIcon(cleanPath);
}
