const { chromium, webkit } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

const browserName = process.argv[2] || "chromium";
const browserType = browserName === "webkit" ? webkit : chromium;

async function waitFor(page, predicate, timeout = 9000) {
  await page.waitForFunction(predicate, null, { timeout });
}

(async () => {
  const browser = await browserType.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://127.0.0.1:8877", { waitUntil: "networkidle" });

  const setup = await page.evaluate(() => ({
    rows: document.querySelectorAll(".player-setup").length,
    toggles: document.querySelectorAll(".ai-toggle input").length
  }));
  if (setup.rows !== 4 || setup.toggles !== 4) throw new Error("AI-valinnat puuttuvat asetuksista");

  await page.selectOption("#playerCount", "2");
  await page.fill("input[name='player-1']", "Lomake-AI");
  await page.check("input[name='player-ai-1']");
  await page.click("button[value='start']");
  const configuredPlayers = await page.evaluate(() => state.players.map((player) => ({
    name: player.name,
    isAI: player.isAI
  })));
  if (configuredPlayers[0].isAI || configuredPlayers[1].name !== "Lomake-AI" || !configuredPlayers[1].isAI) {
    throw new Error(`AI-valinta ei siirtynyt lomakkeelta peliin: ${JSON.stringify(configuredPlayers)}`);
  }

  await page.evaluate(() => {
    if (setupDialog.open) setupDialog.close();
    if (turnDialog.open) turnDialog.close();
    Math.random = () => 0;
    startGame([
      { name: "Ihminen", isAI: false },
      { name: "Taktiikka", isAI: true }
    ]);
    cancelAiTurn();
    state.players[0].hand = [{ type: "number", value: 1, id: "human-1" }];
    state.players[1].hand = [
      { type: "number", value: 0, id: "ai-zero" },
      { type: "number", value: 10, id: "ai-ten" }
    ];
    state.currentIndex = 1;
    state.runningTotal = 11;
    state.discardPile = [{ type: "number", value: 2, id: "discard-2" }];
    state.pendingAiSummary = [];
    lockTurn("Taktiikan vuoro alkaa.");
  });

  const hiddenAiHand = await page.evaluate(() => ({
    cover: Boolean(document.querySelector(".hand-cover")),
    cards: document.querySelectorAll(".card-button").length,
    dialogOpen: turnDialog.open
  }));
  if (!hiddenAiHand.cover || hiddenAiHand.cards !== 0 || hiddenAiHand.dialogOpen) {
    throw new Error("AI:n käsi tai vuorodialogi näkyy väärin");
  }

  await waitFor(page, () => state.currentIndex === 0 && state.turnLocked && turnDialog.open);
  const exact21 = await page.evaluate(() => ({
    total: state.runningTotal,
    aiHand: state.players[1].hand.map((card) => card.value ?? card.kind),
    reason: turnDialogReason.textContent,
    savedAi: JSON.parse(localStorage.getItem(GAME_STORAGE_KEY)).state.players[1].isAI
  }));
  if (exact21.total !== 21 || exact21.aiHand.join() !== "0" || !exact21.reason.includes("Taktiikka pelasi numerokortin 10") || !exact21.savedAi) {
    throw new Error(`AI:n 21-valinta epäonnistui: ${JSON.stringify(exact21)}`);
  }

  await page.evaluate(() => {
    turnDialog.close();
    cancelAiTurn();
    Object.assign(state, {
      currentIndex: 1,
      direction: 1,
      runningTotal: 3,
      gameOver: false,
      turnLocked: true,
      pendingAiSummary: []
    });
    state.players[0].lives = 5;
    state.players[0].eliminated = false;
    state.players[0].hand = [{ type: "number", value: 1, id: "human-2" }];
    state.players[1].lives = 5;
    state.players[1].eliminated = false;
    state.players[1].hand = [
      { type: "wild", kind: "reverse", id: "ai-reverse" },
      { type: "number", value: 5, id: "ai-five" },
      { type: "number", value: 0, id: "ai-zero-2" }
    ];
    lockTurn("Taktiikan vuoro alkaa.");
  });

  await waitFor(page, () => state.currentIndex === 0 && state.turnLocked && turnDialog.open);
  const reverse = await page.evaluate(() => ({
    direction: state.direction,
    aiHand: state.players[1].hand.map((card) => card.value ?? card.kind),
    reason: turnDialogReason.textContent,
    log: state.log.slice(0, 3)
  }));
  if (reverse.direction !== -1 || reverse.aiHand.join() !== "0" || !reverse.reason.includes("Käännös") || !reverse.reason.includes("numerokortin 5")) {
    throw new Error(`AI:n kahden pelaajan lisävuoro epäonnistui: ${JSON.stringify(reverse)}`);
  }

  await page.evaluate(() => {
    turnDialog.close();
    cancelAiTurn();
    Object.assign(state, {
      currentIndex: 1,
      direction: 1,
      runningTotal: 20,
      gameOver: false,
      turnLocked: true,
      pendingAiSummary: []
    });
    state.players[1].lives = 5;
    state.players[1].hand = [{ type: "number", value: 10, id: "blocked-ten" }];
    lockTurn("Taktiikan vuoro alkaa.");
  });

  await waitFor(page, () => state.currentIndex === 0 && state.turnLocked && turnDialog.open);
  const blocked = await page.evaluate(() => ({
    lives: state.players[1].lives,
    total: state.runningTotal,
    reason: turnDialogReason.textContent
  }));
  if (blocked.lives !== 4 || blocked.total !== 0 || !blocked.reason.includes("menetti elämän")) {
    throw new Error(`AI:n automaattinen elämän menetys epäonnistui: ${JSON.stringify(blocked)}`);
  }

  await page.evaluate(() => {
    turnDialog.close();
    cancelAiTurn();
    startGame([
      { name: "AI 1", isAI: true },
      { name: "AI 2", isAI: true },
      { name: "AI 3", isAI: true }
    ]);
  });
  await page.click("#helpButton");
  await page.waitForTimeout(3300);
  const pausedLogEntries = await page.evaluate(() => state.log.length);
  if (pausedLogEntries !== 1) throw new Error("AI ei pysähtynyt sääntödialogin ajaksi");
  await page.evaluate(() => rulesDialog.close());
  await waitFor(page, () => state.log.length >= 2, 7000);
  const allAi = await page.evaluate(() => ({
    allAi: state.players.every((player) => player.isAI),
    logEntries: state.log.length,
    dialogOpen: turnDialog.open,
    handCovered: Boolean(document.querySelector(".hand-cover")),
    title: turnTitle.textContent
  }));
  await page.screenshot({ path: `C:/Users/jouko/AppData/Local/Temp/fivealive-ai-turn-${browserName}.png` });
  if (!allAi.allAi || allAi.logEntries < 2 || allAi.dialogOpen || !allAi.handCovered || !allAi.title.includes("(AI)")) {
    throw new Error(`Kaikkien AI-pelaajien katselutila epäonnistui: ${JSON.stringify(allAi)}`);
  }

  await page.evaluate(() => {
    cancelAiTurn();
    state.gameOver = true;
  });
  await browser.close();
  console.log(`AI player ok (${browserName})`, { setup, configuredPlayers, hiddenAiHand, exact21, reverse, blocked, pausedLogEntries, allAi });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
