import { Windows } from "../index";

await Windows.Apps.fetch();
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
