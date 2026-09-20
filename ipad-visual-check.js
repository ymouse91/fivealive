const { chromium } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  await page.goto("http://127.0.0.1:8877", { waitUntil: "networkidle" });
  await page.selectOption("#playerCount", "6");
  await page.click("button[value='start']");
  await page.click("button[value='start-turn']");
  const initialHand = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".card-button")];
    const rows = new Set(cards.map((el) => Math.round(el.getBoundingClientRect().top))).size;
    const heights = cards.map((el) => el.getBoundingClientRect().height);
    return {
      rows,
      cards: cards.length,
      maxCardHeight: Math.max(...heights)
    };
  });
  await page.evaluate(() => {
    const hand = document.querySelector("#hand");
    const cards = [...hand.querySelectorAll(".card-button")];
    let index = 0;
    while (hand.querySelectorAll(".card-button").length < 20) {
      const clone = cards[index % cards.length].cloneNode(true);
      hand.append(clone);
      index += 1;
    }
  });
  await page.screenshot({ path: "ipad-current-check.png", fullPage: false });

  const metrics = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll("body *")]
      .map((el) => el.getBoundingClientRect())
      .filter((box) => Number.isFinite(box.left) && Number.isFinite(box.right));
    const hand = document.querySelector("#hand").getBoundingClientRect();
    const cardBoxes = [...document.querySelectorAll(".card-button")].map((card) => card.getBoundingClientRect());
    const rowBottoms = [...new Set(cardBoxes.map((box) => Math.round(box.top)))]
      .map((top) => Math.max(...cardBoxes.filter((box) => Math.round(box.top) === top).map((box) => box.bottom)));
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      leftMost: Math.min(...boxes.map((box) => box.left)),
      rightMost: Math.max(...boxes.map((box) => box.right)),
      playerRows: new Set([...document.querySelectorAll(".player-tile")].map((el) => Math.round(el.getBoundingClientRect().top))).size,
      handRows: rowBottoms.length,
      visibleHandRows: rowBottoms.filter((bottom) => bottom <= hand.bottom + 0.5).length,
      handCards: document.querySelectorAll(".card-button").length
    };
  });

  await page.setViewportSize({ width: 1024, height: 600 });
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await page.waitForTimeout(320);
  const resumed = await page.evaluate(() => {
    const app = document.querySelector(".app-shell").getBoundingClientRect();
    const hand = document.querySelector("#hand").getBoundingClientRect();
    const cards = [...document.querySelectorAll(".card-button")].map((card) => card.getBoundingClientRect());
    const rowBottoms = [...new Set(cards.map((box) => Math.round(box.top)))]
      .map((top) => Math.max(...cards.filter((box) => Math.round(box.top) === top).map((box) => box.bottom)));
    return {
      viewportHeight: window.visualViewport?.height ?? window.innerHeight,
      cssHeight: getComputedStyle(document.documentElement).getPropertyValue("--app-height").trim(),
      appBottom: app.bottom,
      scrollHeight: document.documentElement.scrollHeight,
      handRows: rowBottoms.length,
      visibleHandRows: rowBottoms.filter((bottom) => bottom <= hand.bottom + 0.5).length
    };
  });

  await browser.close();
  console.log(JSON.stringify({ initialHand, metrics, resumed }, null, 2));
  if (initialHand.cards === 10 && (initialHand.rows !== 2 || initialHand.maxCardHeight > 101)) {
    process.exit(1);
  }
  if (metrics.overflowX || metrics.leftMost < -1 || metrics.rightMost > metrics.clientWidth + 1) {
    process.exit(1);
  }
  if (metrics.scrollHeight > metrics.clientHeight + 1) {
    process.exit(1);
  }
  if (
    metrics.playerRows !== 1
    || metrics.handCards === 20 && (metrics.handRows !== 3 || metrics.visibleHandRows < 2)
  ) {
    process.exit(1);
  }
  if (
    resumed.viewportHeight !== 600
    || resumed.cssHeight !== "600px"
    || resumed.appBottom > 601
    || resumed.scrollHeight > 601
    || resumed.handRows !== 3
    || resumed.visibleHandRows < 2
  ) {
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
