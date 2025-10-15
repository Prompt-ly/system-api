import { Windows } from "../index";

await Windows.Apps.getApps();
Windows.Apps.listApps().forEach((app) => {
  console.log(app);
});
