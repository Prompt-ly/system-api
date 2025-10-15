import { Windows } from "../index";

const apps = await Windows.Apps.getApps();

const failingApps = [
  "Armoury Crate",
  "Firefox Private Browsing",
  "iCloud",
  "Local Artificial Intelligence Manager",
  "Microsoft Store",
  "ms-resource://MicrosoftWindows.CrossDevice",
  "ms-resource:AIXHost",
  "ms-resource:AppDisplayName",
  "ms-resource:AppTitle",
  "Node.js documentation",
  "Raycast"
];

apps
  .filter((app) => failingApps.some((name) => app.name.includes(name)))
  .forEach((app) => {
    console.log("\n========================================");
    console.log("App:", app.name);
    console.log("Location:", app.location);
    console.log("Icon Path:", app.icon?.path);

    app.icon?.getBase64().then((b64) => {
      console.log("Icon Result:", b64 ? `${b64.substring(0, 50)}...` : "FAILED");
    });
  });
