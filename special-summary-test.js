const { chromium } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8877/", { waitUntil: "networkidle" });

  const prepare = async (players, drawPile = []) => {
    await page.evaluate(({ nextPlayers, nextDrawPile }) => {
      Object.assign(state, {
        players: nextPlayers,
        drawPile: nextDrawPile,
        discardPile: [{ type: "number", value: 4, id: "discard-4" }],
        runningTotal: 4,
        currentIndex: 0,
        direction: 1,
        log: [],
        gameOver: false,
        turnLocked: false,
        turnNotice: null
      });
      if (els.setupDialog.open) els.setupDialog.close();
      if (els.turnDialog.open) els.turnDialog.close();
      if (els.winnerDialog.open) els.winnerDialog.close();
      render();
    }, { nextPlayers: players, nextDrawPile: drawPile });
  };

  await prepare([
    { name: "P1", lives: 5, eliminated: false, hand: [{ type: "wild", kind: "draw2", id: "draw2" }, { type: "number", value: 1, id: "p1-1" }] },
    { name: "P2", lives: 5, eliminated: false, hand: [{ type: "number", value: 2, id: "p2-2" }] },
    { name: "P3", lives: 5, eliminated: false, hand: [{ type: "number", value: 3, id: "p3-3" }] }
  ], [
    { type: "number", value: 5, id: "draw-1" },
    { type: "number", value: 6, id: "draw-2" },
    { type: "number", value: 7, id: "draw-3" },
    { type: "number", value: 8, id: "draw-4" }
  ]);
  await page.evaluate(() => playCard("draw2"));
  await page.waitForSelector("#turnDialog[open]");
  const drawReason = await page.locator("#turnDialogReason").innerText();
  if (!drawReason.includes("P2 nosti 2 korttia.") || !drawReason.includes("P3 nosti 2 korttia.")) {
    throw new Error(`Draw summary was not specific: ${drawReason}`);
  }

  await prepare([
    { name: "P1", lives: 5, eliminated: false, hand: [{ type: "wild", kind: "bomb", id: "bomb" }, { type: "number", value: 1, id: "p1-next" }] },
    { name: "P2", lives: 5, eliminated: false, hand: [{ type: "number", value: 0, id: "p2-0" }, { type: "number", value: 2, id: "p2-next" }] },
    { name: "P3", lives: 2, eliminated: false, hand: [{ type: "wild", kind: "eq0", id: "p3-eq0" }, { type: "number", value: 3, id: "p3-next" }] }
  ]);
  await page.evaluate(() => playCard("bomb"));
  await page.waitForSelector("#turnDialog[open]");
  const bombReason = await page.locator("#turnDialogReason").innerText();
  if (
    !bombReason.includes("P2 poisti 0-kortin.")
    || !bombReason.includes("P3 menetti elämän (1 jäljellä).")
    || !bombReason.includes("Kokonaissumma nollattiin.")
  ) {
    throw new Error(`Bomb summary was not specific: ${bombReason}`);
  }

  await prepare([
    { name: "Voittaja", lives: 4, eliminated: false, hand: [{ type: "wild", kind: "bomb", id: "winning-bomb" }, { type: "number", value: 1, id: "winner-next" }] },
    { name: "Putoaja", lives: 1, eliminated: false, hand: [{ type: "number", value: 2, id: "loser-card" }] }
  ]);
  await page.evaluate(() => playCard("winning-bomb"));
  await page.waitForSelector("#winnerDialog[open]");

  const winner = {
    title: await page.locator("#winnerDialogTitle").innerText(),
    summary: await page.locator("#winnerDialogSummary").innerText()
  };
  if (winner.title !== "Voittaja voitti!" || !winner.summary.includes("viimeiseksi pelaajaksi")) {
    throw new Error(`Winner dialog failed: ${JSON.stringify(winner)}`);
  }

  await page.click("#winnerNewGameButton");
  await page.waitForSelector("#setupDialog[open]");

  await browser.close();
  console.log("special summaries and winner dialog ok", { drawReason, bombReason, winner });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
