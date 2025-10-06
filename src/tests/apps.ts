import { Windows } from "../index";

await Windows.Apps.fetch();
Windows.Apps.listApps().forEach((app) => {
  if (app.name.toLowerCase().includes("raycast")) console.log(app);
});
