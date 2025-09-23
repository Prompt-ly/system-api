import { Windows } from "../index";

await Windows.Apps.fetch();
Windows.Apps.listApps().forEach((app) => {
  console.log(app);
});
