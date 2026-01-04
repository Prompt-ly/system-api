import { Windows } from "../index";

console.log("Fetching installed apps...");
const apps = await Windows.Apps.fetchApps();
console.log(`Found ${apps.length} apps`);

for (const app of apps) {
  app.icon?.getBase64().then((b64) => {
    console.log(b64.length ? "✅" : "❌", app.name);

    if (app.name.toLowerCase().includes("obsidian")) {
      //console.log("Base64:", b64.length ? b64 : "No icon");
      app.open();
    }
  });
}

console.log("This should appear before any icons finish loading.");
