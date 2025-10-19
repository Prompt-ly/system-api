import { Windows } from "../index";

console.log("Fetching installed apps...");
const apps = await Windows.Apps.getApps();
console.log(`Found ${apps.length} apps`);

apps
  .filter((app) => app.name.toLowerCase().includes("raycast"))
  .forEach((app) => {
    console.log(app.name, app.location);
    app.open();
  });

console.log("This should appear before any icons finish loading.");
