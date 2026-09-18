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
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      leftMost: Math.min(...boxes.map((box) => box.left)),
      rightMost: Math.max(...boxes.map((box) => box.right)),
      playerRows: new Set([...document.querySelectorAll(".player-tile")].map((el) => Math.round(el.getBoundingClientRect().top))).size,
      handRows: new Set([...document.querySelectorAll(".card-button")].map((el) => Math.round(el.getBoundingClientRect().top))).size,
      handCards: document.querySelectorAll(".card-button").length
    };
  });

  await browser.close();
  console.log(JSON.stringify({ initialHand, metrics }, null, 2));
  if (initialHand.cards === 10 && (initialHand.rows !== 1 || initialHand.maxCardHeight > 96)) {
    process.exit(1);
  }
  if (metrics.overflowX || metrics.leftMost < -1 || metrics.rightMost > metrics.clientWidth + 1) {
    process.exit(1);
  }
  if (metrics.scrollHeight > metrics.clientHeight + 1) {
    process.exit(1);
  }
  if (metrics.playerRows !== 1 || metrics.handCards === 20 && metrics.handRows !== 2) {
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
