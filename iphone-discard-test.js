const { chromium } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

const cards = [
  ...Array.from({ length: 11 }, (_, value) => ({ type: "number", value, id: `number-${value}` })),
  ...["draw1", "draw2", "pass", "reverse", "skip", "eq21", "eq10", "eq0", "redeal", "bomb"]
    .map((kind) => ({ type: "wild", kind, id: `wild-${kind}` }))
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  await page.goto("http://127.0.0.1:8877/", { waitUntil: "networkidle" });
  await page.selectOption("#playerCount", "2");
  await page.click("button[value='start']");
  await page.click("button[value='start-turn']");

  const measurements = [];
  for (const card of cards) {
    const result = await page.evaluate((nextCard) => {
      state.discardPile = [nextCard];
      render();
      const cardNode = document.querySelector("#discardCard .mini-card");
      const parts = [...cardNode.querySelectorAll(".card-type, .card-value, .card-desc")];
      const visibleParts = parts.filter((part) => getComputedStyle(part).display !== "none");
      const rect = cardNode.getBoundingClientRect();
      return {
        id: nextCard.id,
        width: rect.width,
        height: rect.height,
        cardOverflowX: cardNode.scrollWidth > cardNode.clientWidth + 1,
        cardOverflowY: cardNode.scrollHeight > cardNode.clientHeight + 1,
        overflowingParts: visibleParts
          .filter((part) => part.scrollWidth > Math.ceil(part.getBoundingClientRect().width) + 1)
          .map((part) => `${part.className}:${part.textContent}`),
        visibleText: visibleParts.map((part) => part.textContent.trim()).filter(Boolean)
      };
    }, card);
    measurements.push(result);
  }

  const failures = measurements.filter((result) => (
    result.cardOverflowX || result.cardOverflowY || result.overflowingParts.length
  ));
  if (failures.length) {
    throw new Error(`Discard card overflow: ${JSON.stringify(failures, null, 2)}`);
  }

  await page.evaluate((galleryCards) => {
    document.body.innerHTML = '<main class="discard-gallery" aria-label="Poistopakan korttigalleria"></main>';
    const gallery = document.querySelector(".discard-gallery");
    galleryCards.forEach((card) => {
      const item = document.createElement("section");
      item.className = "pile discard-pile discard-gallery-item";
      item.innerHTML = `<span>${card.type === "number" ? `Numero ${card.value}` : CARD_TEXT[card.kind][0]}</span><div id="discardCard"></div>`;
      item.querySelector("#discardCard").replaceChildren(cardElement(card, false));
      gallery.append(item);
    });
  }, cards);
  await page.addStyleTag({ content: `
    body { overflow: auto; }
    .discard-gallery {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.4rem;
      min-height: 100vh;
      padding: 0.55rem;
    }
    .discard-gallery-item { min-width: 0; }
  ` });
  await page.screenshot({ path: "iphone-discard-gallery.png", fullPage: true });

  await browser.close();
  console.log(JSON.stringify(measurements, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
