import { Windows } from "../index";

console.log("Listing open windows...");
const openWindows = await Windows.Windows.getAllOpenWindows();

console.log(`Found ${openWindows.length} open windows`);
openWindows.forEach((win, idx) => {
  console.log(`#${idx + 1}: ${win.title} (app: ${win.app?.name ?? "unknown"})${win.isFocused ? " [focused]" : ""}`);
});

const window = openWindows.find((win) => win.title.includes("Zen"));
if (window) {
  console.log(`Attempting to refocus: ${window.title}`);
  window.restore();
  window.focus();

  console.log("Path: ", window.app?.path);
}
