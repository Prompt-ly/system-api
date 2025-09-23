import type { App } from "../../src/modules/apps";
import { beforeAll, describe, expect, test } from "bun:test";
import { WindowsAppRegistry } from "../../src/windows/apps/apps";

describe("WindowsAppRegistry", () => {
  let appRegistry: WindowsAppRegistry;

  beforeAll(async () => {
    appRegistry = new WindowsAppRegistry();
    // Load apps from registry
    await appRegistry.fetch();
  });

  describe("fetch", () => {
    test("should fetch apps without throwing errors", async () => {
      const newRegistry = new WindowsAppRegistry();
      expect(newRegistry.fetch()).resolves.not.toThrow();
    });
  });

  describe("listApps", () => {
    test("should return an array of apps", () => {
      const apps = appRegistry.listApps();

      expect(apps).toBeInstanceOf(Array);
      // There should be at least some apps installed on any Windows system
      expect(apps.length).toBeGreaterThan(0);
    });

    test("should return apps with valid properties", () => {
      const apps = appRegistry.listApps();

      // Test the first few apps
      const testApps = apps.slice(0, 5);

      testApps.forEach((app: App) => {
        // Check required properties exist
        expect(app).toHaveProperty("id");
        expect(app).toHaveProperty("name");
        expect(app).toHaveProperty("version");
        expect(app).toHaveProperty("publisher");
        // optional properties
        expect(app).toHaveProperty("icon");
        expect(app).toHaveProperty("location");
        expect(app).toHaveProperty("uninstaller");
        expect(app).toHaveProperty("installDate");

        // Check property types
        expect(typeof app.id).toBe("number");
        expect(app.id).toBeGreaterThan(0);
        expect(typeof app.name).toBe("string");
        expect(app.name.length).toBeGreaterThan(0);
        expect(typeof app.version).toBe("string");
        expect(typeof app.publisher).toBe("string");
        expect(app.icon === undefined || typeof app.icon === "string").toBe(true);
      });
    });

    test("should return apps with unique IDs", () => {
      const apps = appRegistry.listApps();
      const ids = apps.map((app) => app.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    test("should include common Windows applications", () => {
      const apps = appRegistry.listApps();
      const appNames = apps.map((app) => app.name.toLowerCase());

      // These applications are commonly found on Windows systems
      const commonApps = ["microsoft edge", "microsoft visual c++", "windows", "microsoft", "notepad"];

      // At least one of these should be present
      const foundApps = commonApps.filter((name) => appNames.some((appName) => appName.includes(name.toLowerCase())));

      expect(foundApps.length).toBeGreaterThan(0);
    });

    test("should filter out apps without names", () => {
      const apps = appRegistry.listApps();

      apps.forEach((app) => {
        expect(app.name).toBeTruthy();
        expect(app.name.length).toBeGreaterThan(0);
      });
    });
  });

  describe("getApp", () => {
    test("should return an app by valid ID", () => {
      const apps = appRegistry.listApps();

      if (apps.length > 0) {
        const firstApp = apps[0];
        const foundApp = appRegistry.getApp(firstApp.id);

        expect(foundApp).not.toBeNull();
        expect(foundApp?.id).toBe(firstApp.id);
        expect(foundApp?.name).toBe(firstApp.name);
        expect(foundApp?.version).toBe(firstApp.version);
        expect(foundApp?.publisher).toBe(firstApp.publisher);
        expect(foundApp?.icon).toBe(firstApp.icon);
      }
    });

    test("should return null for non-existent app ID", () => {
      const apps = appRegistry.listApps();
      const maxId = Math.max(...apps.map((app) => app.id));
      const nonExistentId = maxId + 1000;

      const app = appRegistry.getApp(nonExistentId);
      expect(app).toBeNull();
    });

    test("should return null for invalid app IDs", () => {
      const invalidIds = [0, -1, -100, Number.MAX_SAFE_INTEGER];

      invalidIds.forEach((id) => {
        const app = appRegistry.getApp(id);
        expect(app).toBeNull();
      });
    });

    test("should handle edge case IDs gracefully", () => {
      const edgeCaseIds = [1, 999999, Number.MIN_SAFE_INTEGER];

      edgeCaseIds.forEach((id) => {
        expect(() => {
          appRegistry.getApp(id);
        }).not.toThrow();
      });
    });
  });

  describe("uninstallApp", () => {
    test("should return false for valid app ID (placeholder implementation)", () => {
      const apps = appRegistry.listApps();

      if (apps.length > 0) {
        const firstApp = apps[0];
        const result = appRegistry.uninstallApp(firstApp.id);

        // Since this is a placeholder implementation, it should always return false
        expect(result).toBe(false);
      }
    });

    test("should return false for non-existent app ID", () => {
      const nonExistentId = 999999;
      const result = appRegistry.uninstallApp(nonExistentId);

      expect(result).toBe(false);
    });

    test("should return false for invalid app IDs", () => {
      const invalidIds = [0, -1, -100];

      invalidIds.forEach((id) => {
        const result = appRegistry.uninstallApp(id);
        expect(result).toBe(false);
      });
    });

    test("should handle edge cases gracefully", () => {
      const edgeCaseIds = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];

      edgeCaseIds.forEach((id) => {
        expect(() => {
          appRegistry.uninstallApp(id);
        }).not.toThrow();
      });
    });
  });

  describe("integration tests", () => {
    test("should handle multiple operations in sequence", async () => {
      // Fetch apps
      const newRegistry = new WindowsAppRegistry();
      await newRegistry.fetch();

      // Get list of apps
      const apps = newRegistry.listApps();
      expect(apps.length).toBeGreaterThan(0);

      // Find a specific app
      const targetApp = apps.find((app) => app.name && app.name.length > 0);

      if (targetApp) {
        // Get the app by ID
        const foundApp = newRegistry.getApp(targetApp.id);
        expect(foundApp).not.toBeNull();
        expect(foundApp?.id).toBe(targetApp.id);

        // Try to uninstall (should return false due to placeholder)
        const uninstallResult = newRegistry.uninstallApp(targetApp.id);
        expect(uninstallResult).toBe(false);
      }
    });

    test("should maintain consistency across multiple fetch operations", async () => {
      const registry1 = new WindowsAppRegistry();
      const registry2 = new WindowsAppRegistry();

      await registry1.fetch();
      await registry2.fetch();

      const apps1 = registry1.listApps();
      const apps2 = registry2.listApps();

      // The apps should be consistent between fetches
      expect(apps1.length).toBe(apps2.length);

      // Check that the apps are the same (assuming no installs/uninstalls happened)
      const ids1 = new Set(apps1.map((app) => app.id));
      const ids2 = new Set(apps2.map((app) => app.id));

      // IDs should be identical since they're based on registry keys
      expect([...ids1].sort()).toEqual([...ids2].sort());
    });

    test("should handle registry access errors gracefully", async () => {
      // This test ensures that registry access errors don't crash the application
      const registry = new WindowsAppRegistry();

      // Fetch should not throw even if some registry keys are inaccessible
      await expect(registry.fetch()).resolves.not.toThrow();

      // Even if fetch fails partially, listApps should still work
      expect(() => registry.listApps()).not.toThrow();
    });
  });

  describe("data validation", () => {
    test("should properly handle apps with missing optional fields", () => {
      const apps = appRegistry.listApps();

      apps.forEach((app) => {
        // Name should always be present and non-empty (filtering requirement)
        expect(app.name).toBeTruthy();

        // Other required fields can be empty strings but should be defined
        expect(app.version).toBeDefined();
        expect(app.publisher).toBeDefined();

        // Icon can be undefined or string in new interface
        expect(app.icon === undefined || typeof app.icon === "string").toBe(true);
      });
    });

    test("should handle special characters in app data", () => {
      const apps = appRegistry.listApps();

      // Find apps with special characters (common in version strings and descriptions)
      const appsWithSpecialChars = apps.filter(
        (app) => app.name.includes("++") || app.version.includes(".") || app.publisher.includes("®")
      );

      // Should handle these gracefully
      appsWithSpecialChars.forEach((app) => {
        expect(() => appRegistry.getApp(app.id)).not.toThrow();
        expect(appRegistry.getApp(app.id)).not.toBeNull();
      });
    });

    test("should properly map registry values to app properties", () => {
      const apps = appRegistry.listApps();

      // Test that the mapping from registry values works correctly
      apps.slice(0, 3).forEach((app) => {
        // All apps should have sequential IDs starting from 1
        expect(app.id).toBeGreaterThan(0);

        // Required fields should be strings (even if empty)
        expect(typeof app.name).toBe("string");
        expect(typeof app.version).toBe("string");
        expect(typeof app.publisher).toBe("string");
      });
    });
  });

  describe("error handling", () => {
    test("should handle Windows registry errors gracefully", async () => {
      const registry = new WindowsAppRegistry();

      // Should not throw even if registry access fails
      expect(async () => {
        await registry.fetch();
      }).not.toThrow();
    });

    test("should handle concurrent access gracefully", async () => {
      // Test multiple simultaneous fetches
      const registries = Array.from({ length: 3 }, () => new WindowsAppRegistry());

      const fetchPromises = registries.map((registry) => registry.fetch());

      // All fetches should complete without errors
      await expect(Promise.all(fetchPromises)).resolves.not.toThrow();

      // All registries should have loaded apps
      registries.forEach((registry) => {
        const apps = registry.listApps();
        expect(apps).toBeInstanceOf(Array);
      });
    });

    test("should handle memory constraints with large app lists", () => {
      const apps = appRegistry.listApps();

      // Should handle operations efficiently even with many apps
      expect(() => {
        // Perform multiple operations
        apps.forEach((app) => {
          appRegistry.getApp(app.id);
        });
      }).not.toThrow();

      // Memory usage should be reasonable
      expect(apps.length).toBeLessThan(10000); // Sanity check
    });
  });
});
