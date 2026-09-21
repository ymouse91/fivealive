const { chromium } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

const viewports = [
  { width: 375, height: 667, name: "iphone-se" },
  { width: 390, height: 844, name: "iphone-390" },
  { width: 430, height: 932, name: "iphone-430" }
];

(async () => {
  const browser = await chromium.launch();
  const results = [];

  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });
    await page.goto("http://127.0.0.1:8877/", { waitUntil: "networkidle" });
    await page.selectOption("#playerCount", "6");
    await page.click("button[value='start']");
    await page.click("button[value='start-turn']");

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const hand = document.querySelector("#hand").getBoundingClientRect();
      const cards = [...document.querySelectorAll(".card-button")];
      const cardBoxes = cards.map((card) => card.getBoundingClientRect());
      const numberType = document.querySelector(".card-number .card-type");
      const description = document.querySelector(".card-desc");
      return {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        clientHeight: root.clientHeight,
        scrollHeight: root.scrollHeight,
        bodyOverflowY: getComputedStyle(document.body).overflowY,
        handWidth: hand.width,
        columns: new Set(cardBoxes.map((box) => Math.round(box.left))).size,
        maxCardHeight: Math.max(...cardBoxes.map((box) => box.height)),
        numberTypeHidden: !numberType || getComputedStyle(numberType).display === "none",
        descriptionHidden: !description || getComputedStyle(description).display === "none"
      };
    });

    if (
      metrics.scrollWidth > metrics.clientWidth + 1
      || metrics.scrollHeight <= metrics.clientHeight
      || metrics.bodyOverflowY !== "auto"
      || metrics.columns !== 4
      || metrics.maxCardHeight > 97
      || !metrics.numberTypeHidden
      || !metrics.descriptionHidden
    ) {
      throw new Error(`${viewport.name} layout failed: ${JSON.stringify(metrics)}`);
    }

    if (viewport.width === 390) {
      await page.screenshot({ path: "iphone-current-check.png", fullPage: true });
    }
    results.push({ viewport: viewport.name, ...metrics });
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
