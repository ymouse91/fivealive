const { chromium } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8877", { waitUntil: "networkidle" });

  const results = await page.evaluate(() => {
    function setScenario(playerCount) {
      startGame(Array.from({ length: playerCount }, (_, index) => `Pelaaja ${index + 1}`));
      state.players.forEach((player, index) => {
        player.hand = [{ type: "number", value: 0, id: `filler-${index}` }];
      });
      state.players[0].hand.unshift({ type: "wild", kind: "reverse", id: "test-reverse" });
      state.currentIndex = 0;
      state.direction = 1;
      state.runningTotal = 0;
      state.gameOver = false;
      state.turnLocked = false;
      state.turnNotice = null;
      if (els.turnDialog.open) els.turnDialog.close();

      playCard("test-reverse");

      return {
        playerCount,
        currentIndex: state.currentIndex,
        direction: state.direction,
        turnLocked: state.turnLocked,
        currentPlayer: currentPlayer().name
      };
    }

    return [2, 3, 4, 5, 6].map(setScenario);
  });

  const expected = [2, 3, 4, 5, 6].map((playerCount) => ({
    playerCount,
    currentIndex: playerCount === 2 ? 0 : playerCount - 1,
    direction: -1,
    turnLocked: playerCount !== 2,
    currentPlayer: playerCount === 2 ? "Pelaaja 1" : `Pelaaja ${playerCount}`
  }));

  if (JSON.stringify(results) !== JSON.stringify(expected)) {
    throw new Error(`Reverse turn order failed: ${JSON.stringify(results)}`);
  }

  await browser.close();
  console.log("reverse turn order ok", results);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
