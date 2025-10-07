import type { AppIcon as IAppIcon } from "@/modules/apps";
import { extractIconAsBase64 } from "./icon-extractor";

/**
 * Create an AppIcon object with lazy loading and caching
 */
export function createAppIcon(path: string, preloadedBase64?: string | null): IAppIcon {
  let cachedBase64: string | null = preloadedBase64 ?? null;
  let loadPromise: Promise<string> | null = null;

  return {
    path,
    getBase64: async (): Promise<string> => {
      // Return cached value if available
      if (cachedBase64 !== null) {
        return cachedBase64;
      }

      // If already loading, return the existing promise
      if (loadPromise) {
        return loadPromise;
      }

      // Start loading
      loadPromise = (async () => {
        try {
          if (cachedBase64 !== null) {
            return cachedBase64;
          }
          const base64 = await extractIconAsBase64(path);
          cachedBase64 = base64 ?? "";
          return cachedBase64;
        } catch {
          cachedBase64 = "";
          return "";
        } finally {
          loadPromise = null;
        }
      })();

      return loadPromise;
    }
  };
}
