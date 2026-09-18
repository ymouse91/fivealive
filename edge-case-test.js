const { chromium } = require("C:/Users/jouko/Documents/codex-tools/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8877/", { waitUntil: "networkidle" });

  const results = await page.evaluate(() => {
    const number = (value, id) => ({ type: "number", value, id });
    const wild = (kind, id) => ({ type: "wild", kind, id });

    function setPlayers(players) {
      Object.assign(state, {
        players,
        drawPile: makeDeck(),
        discardPile: [number(4, "discard-4")],
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
    }

    setPlayers([
      { name: "P1", lives: 5, eliminated: false, hand: [wild("bomb", "bomb"), number(1, "p1-1")] },
      { name: "P2", lives: 5, eliminated: false, hand: [number(0, "p2-0"), number(2, "p2-2")] },
      { name: "P3", lives: 2, eliminated: false, hand: [wild("eq0", "p3-eq0"), number(3, "p3-3")] }
    ]);
    playCard("bomb");
    const bomb = {
      p2Lives: state.players[1].lives,
      p2HasZero: state.players[1].hand.some((card) => card.type === "number" && card.value === 0),
      p3Lives: state.players[2].lives,
      p3HasEq0: state.players[2].hand.some((card) => card.kind === "eq0"),
      total: state.runningTotal,
      next: currentPlayer().name
    };

    setPlayers([
      { name: "Voittaja", lives: 5, eliminated: false, hand: [wild("bomb", "winning-bomb"), number(1, "winner-1")] },
      { name: "Putoaja", lives: 1, eliminated: false, hand: [number(2, "loser-2")] }
    ]);
    playCard("winning-bomb");
    const bombWin = {
      gameOver: state.gameOver,
      loserEliminated: state.players[1].eliminated,
      title: els.turnTitle.textContent
    };

    setPlayers([
      { name: "P1", lives: 5, eliminated: false, hand: [number(1, "p1-card")] },
      { name: "P2", lives: 5, eliminated: false, hand: [number(2, "p2-card")] }
    ]);
    state.drawPile = [];
    state.discardPile = [number(3, "recycle-3"), number(4, "recycle-4"), number(5, "top-5")];
    const recycled = drawCard();
    const recycle = {
      drawnFromDiscard: ["recycle-3", "recycle-4"].includes(recycled.id),
      topPreserved: state.discardPile.length === 1 && state.discardPile[0].id === "top-5",
      cardsRemaining: state.drawPile.length
    };

    setPlayers([
      { name: "P1", lives: 5, eliminated: false, hand: [wild("reverse", "two-left-reverse"), number(1, "p1-next")] },
      { name: "P2", lives: 0, eliminated: true, hand: [] },
      { name: "P3", lives: 5, eliminated: false, hand: [number(3, "p3-next")] }
    ]);
    playCard("two-left-reverse");
    const twoLeftReverse = {
      current: currentPlayer().name,
      direction: state.direction,
      turnLocked: state.turnLocked
    };

    setPlayers([
      { name: "P1", lives: 5, eliminated: false, hand: [wild("skip", "two-left-skip"), number(1, "p1-next-2")] },
      { name: "P2", lives: 0, eliminated: true, hand: [] },
      { name: "P3", lives: 5, eliminated: false, hand: [number(3, "p3-next-2")] }
    ]);
    playCard("two-left-skip");
    const twoLeftSkip = {
      current: currentPlayer().name,
      turnLocked: state.turnLocked
    };

    setPlayers([
      { name: "P1", lives: 5, eliminated: false, hand: [wild("redeal", "last-redeal")] },
      { name: "P2", lives: 5, eliminated: false, hand: [number(2, "deal-2"), number(3, "deal-3")] },
      { name: "P3", lives: 5, eliminated: false, hand: [number(4, "deal-4"), number(5, "deal-5")] }
    ]);
    playCard("last-redeal");
    const lastRedeal = {
      lives: state.players.map((player) => player.lives),
      handSizes: state.players.map((player) => player.hand.length),
      starter: currentPlayer().name,
      turnLocked: state.turnLocked
    };

    return { bomb, bombWin, recycle, twoLeftReverse, twoLeftSkip, lastRedeal };
  });

  const expected = {
    bomb: { p2Lives: 5, p2HasZero: false, p3Lives: 1, p3HasEq0: true, total: 0, next: "P2" },
    bombWin: { gameOver: true, loserEliminated: true, title: "Voittaja voitti" },
    recycle: { drawnFromDiscard: true, topPreserved: true, cardsRemaining: 1 },
    twoLeftReverse: { current: "P1", direction: -1, turnLocked: false },
    twoLeftSkip: { current: "P1", turnLocked: false },
    lastRedeal: { lives: [5, 4, 4], handSizes: [10, 10, 10], starter: "P1", turnLocked: true }
  };

  if (JSON.stringify(results) !== JSON.stringify(expected)) {
    throw new Error(`Edge case failure:\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(results)}`);
  }

  await browser.close();
  console.log("edge cases ok", results);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
