const { chromium, webkit } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

const browserName = process.argv[2] || "chromium";
const browserType = browserName === "webkit" ? webkit : chromium;

const cases = [
  { name: "macbook-1512x982", width: 1512, height: 982 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "laptop-1366x768", width: 1366, height: 768 },
  { name: "laptop-1280x720", width: 1280, height: 720 },
  { name: "compact-1024x768", width: 1024, height: 768 }
];

(async () => {
  const browser = await browserType.launch();
  const results = [];

  for (const testCase of cases) {
    const page = await browser.newPage({ viewport: { width: testCase.width, height: testCase.height } });
    await page.goto("http://127.0.0.1:8877", { waitUntil: "networkidle" });
    await page.selectOption("#playerCount", "6");
    await page.click("button[value='start']");
    await page.click("button[value='start-turn']");

    if (testCase.name === "laptop-1280x720") {
      await page.screenshot({ path: `C:/Users/jouko/AppData/Local/Temp/fivealive-pc-1280-${browserName}.png` });
    }

    const metrics = await page.evaluate(() => {
      const rect = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
      };
      const center = rect(".center-board");
      const total = rect(".total-orb");
      const status = rect(".status-row");
      const score = rect(".score-strip");
      const panel = rect(".table-panel");
      const centerChildren = [...document.querySelectorAll(".center-board > *")]
        .map((element) => element.getBoundingClientRect());
      return {
        viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
        scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        center,
        total,
        status,
        panel,
        totalInsideCenter:
          total.top >= center.top - 1
          && total.bottom <= center.bottom + 1
          && total.left >= center.left - 1
          && total.right <= center.right + 1,
        allCenterItemsInside: centerChildren.every((item) =>
          item.top >= center.top - 1
          && item.bottom <= center.bottom + 1
          && item.left >= center.left - 1
          && item.right <= center.right + 1),
        centerItemsClearAdjacentRows: centerChildren.every((item) =>
          item.top >= score.bottom - 1
          && item.bottom <= status.top + 1
          && item.left >= center.left - 1
          && item.right <= center.right + 1),
        noPageOverflow:
          document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
          && document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
        centerBeforeStatus: center.bottom <= status.top + 1
      };
    });

    results.push({ browser: browserName, ...testCase, ...metrics });
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) =>
    !result.totalInsideCenter
    || !result.centerItemsClearAdjacentRows
    || !result.noPageOverflow
    || !result.centerBeforeStatus)) {
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
