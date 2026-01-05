import { Windows } from "../index";

console.log("Listing open windows...");
const openWindows = await Windows.Windows.getAllOpenWindows();

console.log(`Found ${openWindows.length} open windows`);
openWindows.forEach((win, idx) => {
  console.log(`#${idx + 1}: ${win.title} (app: ${win.app?.name ?? "unknown"})${win.isFocused ? " [focused]" : ""}`);
});

if (openWindows.length > 0) {
  const firstWindow = openWindows[0];
  console.log(`Fetching thumbnail for: ${firstWindow?.title}`);
  const thumbnail = await firstWindow?.getThumbnail();
  if (thumbnail) {
    console.log(`Thumbnail fetched! Length: ${thumbnail.length}`);
    console.log(`Preview: ${thumbnail.substring(0, 50)}...`);
  } else {
    console.log("Failed to fetch thumbnail.");
  }
}

console.log(openWindows.map((win) => win.app?.name ?? "unknown").join("\n"));

// const window = openWindows.find((win) => win.title.includes("Zen"));
// if (window) {
//   console.log(`Maximising window: ${window.title}`);
//   window.maximize();

//   await new Promise((resolve) => setTimeout(resolve, 2000));

//   console.log(`Restoring window: ${window.title}`);
//   window.restore();

//   await new Promise((resolve) => setTimeout(resolve, 2000));

//   console.log(`Minimising window: ${window.title}`);
//   window.minimize();

//   await new Promise((resolve) => setTimeout(resolve, 2000));

//   console.log(`Closing window: ${window.title}`);
//   window.close();
// }
