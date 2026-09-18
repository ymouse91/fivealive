const { chromium } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:8877", { waitUntil: "networkidle" });
  await page.selectOption("#playerCount", "4");
  await page.click("button[value='start']");
  await page.waitForSelector("#turnDialog[open]");
  await page.click("button[value='start-turn']");
  await page.waitForSelector(".card-button");
  const title = await page.locator("#turnTitle").innerText();
  const total = await page.locator("#runningTotal").innerText();
  const enabledCards = await page.locator(".card-button:not([disabled])").count();
  if (!title.includes("Pelaaja 1") || Number.isNaN(Number(total)) || enabledCards < 1) {
    throw new Error(`Bad initial state: title=${title}, total=${total}, enabled=${enabledCards}`);
  }
  await page.locator(".card-button:not([disabled])").first().click();
  await page.waitForSelector("#turnDialog[open]");
  const turnReason = await page.locator("#turnDialogReason").innerText();
  const coveredHands = await page.locator(".hand-cover").count();
  if (!turnReason || coveredHands !== 1) {
    throw new Error(`Turn dialog did not explain or hide hand: reason=${turnReason}, covered=${coveredHands}`);
  }
  await page.screenshot({ path: "turn-dialog-smoke.png", fullPage: true });
  await page.click("button[value='start-turn']");
  await page.waitForTimeout(120);
  const secondTitle = await page.locator("#turnTitle").innerText();
  if (!secondTitle.includes("Pelaaja")) {
    throw new Error(`Turn did not advance: ${secondTitle}`);
  }
  await page.screenshot({ path: "pc-smoke.png", fullPage: true });

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.screenshot({ path: "ipad-landscape-smoke.png", fullPage: true });

  const layout = await page.evaluate(() => {
    const body = document.body.getBoundingClientRect();
    const hand = document.querySelector("#hand").getBoundingClientRect();
    const totalBox = document.querySelector(".total-orb").getBoundingClientRect();
    return {
      bodyWidth: body.width,
      handWidth: hand.width,
      totalWidth: totalBox.width,
      totalHeight: totalBox.height,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    };
  });
  if (layout.overflowX || layout.handWidth < 300 || layout.totalWidth < 100 || layout.totalHeight < 100) {
    throw new Error(`Layout check failed: ${JSON.stringify(layout)}`);
  }

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: "ipad-1024-smoke.png", fullPage: true });
  const ipad = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    grid: getComputedStyle(document.querySelector(".app-shell")).gridTemplateColumns,
    handWidth: document.querySelector("#hand").getBoundingClientRect().width
  }));
  if (ipad.overflowX || ipad.handWidth < 300) {
    throw new Error(`1024px iPad layout failed: ${JSON.stringify(ipad)}`);
  }

  await browser.close();
  console.log("smoke ok", { title, total, enabledCards, secondTitle, turnReason, layout, ipad });
})().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
