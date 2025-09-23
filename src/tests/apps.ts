import { Windows } from "../index";

await Windows.Apps.fetch();
Windows.Apps.listApps().forEach((app) => {
  if (app.name.toLowerCase().includes("notion")) console.log(app);
});
