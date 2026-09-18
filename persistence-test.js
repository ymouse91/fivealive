const { chromium } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8877/", { waitUntil: "networkidle" });

  await page.evaluate(() => {
    startGame(["Aino", "Bertta", "Cecilia"]);
    state.currentIndex = 2;
    state.runningTotal = 17;
    state.direction = -1;
    state.players[1].lives = 3;
    state.turnLocked = false;
    state.turnNotice = null;
    if (els.setupDialog.open) els.setupDialog.close();
    if (els.turnDialog.open) els.turnDialog.close();
    render();
  });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#turnDialog[open]");

  const restored = await page.evaluate(() => ({
    names: state.players.map((player) => player.name),
    lives: state.players.map((player) => player.lives),
    currentIndex: state.currentIndex,
    runningTotal: state.runningTotal,
    direction: state.direction,
    turnLocked: state.turnLocked,
    setupOpen: els.setupDialog.open,
    handCovered: Boolean(document.querySelector(".hand-cover")),
    reason: els.turnDialogReason.textContent
  }));

  const expected = {
    names: ["Aino", "Bertta", "Cecilia"],
    lives: [5, 3, 5],
    currentIndex: 2,
    runningTotal: 17,
    direction: -1,
    turnLocked: true,
    setupOpen: false,
    handCovered: true,
    reason: "Tallennettu peli palautettiin. Cecilia jatkaa vuoroaan."
  };

  if (JSON.stringify(restored) !== JSON.stringify(expected)) {
    throw new Error(`Saved game restoration failed: ${JSON.stringify(restored)}`);
  }

  await page.click("button[value='start-turn']");
  if (await page.locator(".card-button").count() !== 10) {
    throw new Error("Restored player's hand was not revealed correctly");
  }

  await page.evaluate((storageKey) => localStorage.setItem(storageKey, "{broken"), "fivealive-saved-game-v1");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#setupDialog[open]");
  if (await page.locator("#turnDialog[open]").count()) {
    throw new Error("Broken saved data should fall back to the new game dialog");
  }

  await browser.close();
  console.log("persistence ok", restored);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
