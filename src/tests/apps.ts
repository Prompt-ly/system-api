import { Windows } from "../index";

console.log("Fetching installed apps...");
await Windows.Apps.fetch();
console.log(`Found ${Windows.Apps.listApps().length} apps`);

Windows.Apps.listApps().forEach((app) => {
  // if (app.name.toLowerCase().includes("notion")) {
  //   console.log(app);

  //   app.icon?.getBase64().then((b64) => {
  //     console.log("Icon Base64:", b64.length ? b64 : "No icon");
  //   });

  //   return;
  // }

  app.icon?.getBase64().then((b64) => {
    console.log(b64.length ? "✅" : "❌", app.name);
  });
});
