import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import koffi from "koffi";
import {
  BITMAP,
  BITMAPINFOHEADER,
  DeleteObject,
  DestroyIcon,
  DIB_RGB_COLORS,
  ExtractIconExW,
  GetDC,
  GetDIBits,
  GetIconInfo,
  GetObject,
  ReleaseDC,
  SHFILEINFOW,
  SHGetFileInfoW,
  SHGFI_ICON,
  SHGFI_SMALLICON
} from "./koffi-defs";

// Helper to run blocking operations asynchronously
const runAsync = <T>(fn: () => T): Promise<T> => {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      try {
        resolve(fn());
      } catch (error) {
        reject(error);
      }
    });
  });
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".svg", ".ico"];
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
    const getIconInfoResult = await runAsync(() => GetIconInfo(hIcon, iconInfo));

    if (!getIconInfoResult) {
      await runAsync(() => DestroyIcon(hIcon));
      return null;
    }

    const hdc = await runAsync(() => GetDC(null));
    if (!hdc) {
      await runAsync(() => DestroyIcon(hIcon));
      return null;
    }

    // Get actual bitmap dimensions
    const bitmapInfo = Buffer.alloc(koffi.sizeof(BITMAP));
    const result = await runAsync(() => GetObject(iconInfo.hbmColor, koffi.sizeof(BITMAP), bitmapInfo));

    if (result === 0) {
      await runAsync(() => ReleaseDC(null, hdc));
      await runAsync(() => DeleteObject(iconInfo.hbmMask));
      await runAsync(() => DeleteObject(iconInfo.hbmColor));
      await runAsync(() => DestroyIcon(hIcon));
      return null;
    }

    const bitmap = koffi.decode(bitmapInfo, BITMAP);
    const width = Math.abs(bitmap.bmWidth);
    const height = Math.abs(bitmap.bmHeight);

    // Ensure we have valid dimensions
    if (width === 0 || height === 0 || width > 256 || height > 256) {
      await runAsync(() => ReleaseDC(null, hdc));
      await runAsync(() => DeleteObject(iconInfo.hbmMask));
      await runAsync(() => DeleteObject(iconInfo.hbmColor));
      await runAsync(() => DestroyIcon(hIcon));
      return null;
    }

    const bmi = Buffer.alloc(1024);
    const bmiHeader = {
      biSize: 40,
      biWidth: width,
      biHeight: height,
      biPlanes: 1,
      biBitCount: 32,
      biCompression: 0,
      biSizeImage: 0,
      biXPelsPerMeter: 0,
      biYPelsPerMeter: 0,
      biClrUsed: 0,
      biClrImportant: 0
    };

    const bufferSize = width * height * 4;
    const pixelData = Buffer.alloc(bufferSize);

    koffi.encode(bmi, BITMAPINFOHEADER, bmiHeader);

    const dibResult = await runAsync(() =>
      GetDIBits(hdc, iconInfo.hbmColor, 0, height, pixelData, bmi, DIB_RGB_COLORS)
    );

    await runAsync(() => ReleaseDC(null, hdc));
    await runAsync(() => DeleteObject(iconInfo.hbmMask));
    await runAsync(() => DeleteObject(iconInfo.hbmColor));
    await runAsync(() => DestroyIcon(hIcon));

    if (dibResult === 0) {
      return null;
    }

    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0);
    icoHeader.writeUInt16LE(1, 2);
    icoHeader.writeUInt16LE(1, 4);

    const icoEntry = Buffer.alloc(16);
    icoEntry.writeUInt8(width >= 256 ? 0 : width, 0);
    icoEntry.writeUInt8(height >= 256 ? 0 : height, 1);
    icoEntry.writeUInt8(0, 2);
    icoEntry.writeUInt8(0, 3);
    icoEntry.writeUInt16LE(1, 4);
    icoEntry.writeUInt16LE(32, 6);
    icoEntry.writeUInt32LE(pixelData.length + 40, 8);
    icoEntry.writeUInt32LE(22, 12);

    const icoBitmapInfo = Buffer.alloc(40);
    icoBitmapInfo.writeUInt32LE(40, 0);
    icoBitmapInfo.writeInt32LE(width, 4);
    icoBitmapInfo.writeInt32LE(height * 2, 8);
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

async function extractEmbeddedIcon(filePath: string, index: number = 0): Promise<string | null> {
  try {
    const wideFilePath = toWide(filePath);
    const largeIconPtr = [0];
    const smallIconPtr = [0];

    const count = await runAsync(() => ExtractIconExW(wideFilePath, index, largeIconPtr, smallIconPtr, 1));
    if (count > 0) {
      if (smallIconPtr[0]) {
        const small = await iconToBase64(smallIconPtr[0]);
        if (small) return small;
      }
      if (largeIconPtr[0]) {
        const large = await iconToBase64(largeIconPtr[0]);
        if (large) return large;
      }
    }

    // If negative resource id was provided, try absolute value as index
    if (index < 0) {
      const absIndex = Math.abs(index);
      const large2 = [0];
      const small2 = [0];
      const count2 = await runAsync(() => ExtractIconExW(wideFilePath, absIndex, large2, small2, 1));
      if (count2 > 0) {
        if (small2[0]) {
          const small = await iconToBase64(small2[0]);
          if (small) return small;
        }
        if (large2[0]) {
          const large = await iconToBase64(large2[0]);
          if (large) return large;
        }
      }
    }

    // Probe a small range of indices to find a valid icon
    for (let i = 0; i < 8; i++) {
      const large3 = [0];
      const small3 = [0];
      const count3 = await runAsync(() => ExtractIconExW(wideFilePath, i, large3, small3, 1));
      if (count3 > 0) {
        if (small3[0]) {
          const small = await iconToBase64(small3[0]);
          if (small) return small;
        }
        if (large3[0]) {
          const large = await iconToBase64(large3[0]);
          if (large) return large;
        }
      }
    }

    // Fallback to SHGetFileInfoW default icon
    const fileInfo = {} as {
      hIcon: unknown;
      iIcon: number;
      dwAttributes: number;
      szDisplayName: Uint16Array;
      szTypeName: Uint16Array;
    };
    const wideFilePathForShell = toWide(filePath);
    const result = await runAsync(() =>
      SHGetFileInfoW(wideFilePathForShell, 0, fileInfo, koffi.sizeof(SHFILEINFOW), SHGFI_ICON | SHGFI_SMALLICON)
    );
    if (result && fileInfo.hIcon) {
      return await iconToBase64(fileInfo.hIcon);
    }
    return null;
  } catch {
    return null;
  }
}

async function fileToBase64DataURI(filePath: string): Promise<string | null> {
  try {
    const buffer = await readFile(filePath);
    const ext = extname(filePath);
    const mimeType = getMime(ext);
    const base64 = buffer.toString("base64");

    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

function parsePathAndIndex(rawPath: string): { path: string; index: number } {
  const trimmed = rawPath.trim().replace(/^"|"$/g, "");
  const idx = trimmed.lastIndexOf(",");
  if (idx > 1 && idx < rawPath.length - 1) {
    const path = trimmed.slice(0, idx);
    const rest = trimmed.slice(idx + 1).trim();
    const index = Number.parseInt(rest, 10);
    if (!Number.isNaN(index)) return { path, index };
  }
  return { path: trimmed, index: 0 };
}

export async function extractIconAsBase64(filePath: string | undefined | null): Promise<string | null> {
  if (!filePath || !filePath.trim()) return null;

  const { path, index } = parsePathAndIndex(filePath.trim());
  const ext = extname(path).toLowerCase();

  if (IMAGE_EXTENSIONS.includes(ext)) {
    return await fileToBase64DataURI(path);
  }

  if (EXECUTABLE_EXTENSIONS.includes(ext)) {
    return await extractEmbeddedIcon(path, index);
  }

  return null;
}
