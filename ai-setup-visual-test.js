const { chromium, webkit } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

const browserName = process.argv[2] || "chromium";
const browserType = browserName === "webkit" ? webkit : chromium;
const viewports = [
  { name: "iphone", width: 390, height: 844 },
  { name: "ipad", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 }
];

(async () => {
  const browser = await browserType.launch();
  const results = [];

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto("http://127.0.0.1:8877", { waitUntil: "networkidle" });
    await page.selectOption("#playerCount", "6");
    const metrics = await page.evaluate(() => {
      const dialog = setupDialog.getBoundingClientRect();
      const form = setupForm.getBoundingClientRect();
      const rows = [...document.querySelectorAll(".player-setup")].map((row) => row.getBoundingClientRect());
      return {
        rows: rows.length,
        toggles: document.querySelectorAll(".ai-toggle input").length,
        viewportWidth: document.documentElement.clientWidth,
        dialogLeft: dialog.left,
        dialogRight: dialog.right,
        formHeight: form.height,
        dialogHeight: dialog.height,
        dialogScrollable: setupDialog.scrollHeight > setupDialog.clientHeight,
        rowsInside: rows.every((row) => row.left >= dialog.left && row.right <= dialog.right)
      };
    });
    if (browserName === "webkit" && ["iphone", "desktop"].includes(viewport.name)) {
      await page.screenshot({ path: `C:/Users/jouko/AppData/Local/Temp/fivealive-ai-setup-${viewport.name}.png` });
    }
    results.push({ browser: browserName, ...viewport, ...metrics });
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) =>
    result.rows !== 6
    || result.toggles !== 6
    || result.dialogLeft < -1
    || result.dialogRight > result.viewportWidth + 1
    || !result.rowsInside)) {
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
