const CARD_TEXT = {
  draw1: ["Nosta 1", "+1", "Muut nostavat 1"],
  draw2: ["Nosta 2", "+2", "Muut nostavat 2"],
  pass: ["Jätän väliin", "PASS", "Vuoro eteenpäin"],
  reverse: ["Käännös", "↺", "Suunta vaihtuu"],
  skip: ["Ohitus", "⤼", "Seuraava ohi"],
  eq21: ["=21", "21", "Summa on 21"],
  eq10: ["=10", "10", "Summa on 10"],
  eq0: ["=0", "0", "Summa nollaan"],
  redeal: ["Uusi jako", "⟳", "Kädet uusiksi"],
  bomb: ["Pommi", "BOMB", "0 tai elämä"]
};

const GAME_STORAGE_KEY = "fivealive-saved-game-v1";
const GAME_STORAGE_VERSION = 1;
const AI_REVEAL_DELAY = 1800;
const AI_PLAY_DELAY = 1200;

let aiTimer = null;
let aiTurnToken = 0;

function syncViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.floor(height)}px`);
}

function refreshViewportHeight() {
  syncViewportHeight();
  window.requestAnimationFrame(syncViewportHeight);
  window.setTimeout(syncViewportHeight, 250);
}

window.addEventListener("pageshow", refreshViewportHeight);
window.addEventListener("orientationchange", refreshViewportHeight);
window.addEventListener("resize", syncViewportHeight);
window.visualViewport?.addEventListener("resize", syncViewportHeight);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshViewportHeight();
});
refreshViewportHeight();

const state = {
  players: [],
  drawPile: [],
  discardPile: [],
  runningTotal: 0,
  currentIndex: 0,
  direction: 1,
  log: [],
  gameOver: false,
  turnLocked: true,
  turnNotice: null,
  pendingAiSummary: []
};

const els = {
  setupDialog: document.querySelector("#setupDialog"),
  rulesDialog: document.querySelector("#rulesDialog"),
  setupForm: document.querySelector("#setupForm"),
  playerCount: document.querySelector("#playerCount"),
  nameFields: document.querySelector("#nameFields"),
  playersBoard: document.querySelector("#playersBoard"),
  drawCount: document.querySelector("#drawCount"),
  runningTotal: document.querySelector("#runningTotal"),
  discardCard: document.querySelector("#discardCard"),
  directionLabel: document.querySelector("#directionLabel"),
  currentPlayerLabel: document.querySelector("#currentPlayerLabel"),
  turnTitle: document.querySelector("#turnTitle"),
  hand: document.querySelector("#hand"),
  handHint: document.querySelector("#handHint"),
  stateText: document.querySelector("#stateText"),
  log: document.querySelector("#log"),
  takeLifeButton: document.querySelector("#takeLifeButton"),
  newGameButton: document.querySelector("#newGameButton"),
  helpButton: document.querySelector("#helpButton"),
  turnDialog: document.querySelector("#turnDialog"),
  turnForm: document.querySelector("#turnForm"),
  turnDialogTitle: document.querySelector("#turnDialogTitle"),
  turnDialogReason: document.querySelector("#turnDialogReason"),
  turnDialogTotal: document.querySelector("#turnDialogTotal"),
  turnDialogDiscard: document.querySelector("#turnDialogDiscard"),
  turnDialogDirection: document.querySelector("#turnDialogDirection"),
  winnerDialog: document.querySelector("#winnerDialog"),
  winnerDialogTitle: document.querySelector("#winnerDialogTitle"),
  winnerDialogSummary: document.querySelector("#winnerDialogSummary"),
  winnerNewGameButton: document.querySelector("#winnerNewGameButton")
};

function makeDeck() {
  const deck = [];
  let id = 0;
  const add = (card, count) => {
    for (let i = 0; i < count; i += 1) {
      deck.push({ ...card, id: `${card.type}-${card.value ?? card.kind}-${id += 1}` });
    }
  };

  [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 6], [6, 4], [7, 4], [8, 4], [9, 4], [10, 6]]
    .forEach(([value, count]) => add({ type: "number", value }, count));

  [
    ["draw1", 4], ["draw2", 4], ["pass", 4], ["reverse", 4], ["skip", 6],
    ["eq21", 5], ["eq10", 4], ["eq0", 4], ["redeal", 2], ["bomb", 3]
  ].forEach(([kind, count]) => add({ type: "wild", kind }, count));

  return shuffle(deck);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildNameFields() {
  const count = Number(els.playerCount.value);
  els.nameFields.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const row = document.createElement("div");
    row.className = "player-setup";

    const label = document.createElement("label");
    label.className = "player-name-field";
    label.textContent = `Pelaaja ${i + 1}`;
    const input = document.createElement("input");
    input.name = `player-${i}`;
    input.maxLength = 18;
    input.value = `Pelaaja ${i + 1}`;
    label.append(input);

    const aiLabel = document.createElement("label");
    aiLabel.className = "ai-toggle";
    const aiInput = document.createElement("input");
    aiInput.type = "checkbox";
    aiInput.name = `player-ai-${i}`;
    const aiText = document.createElement("span");
    aiText.textContent = "AI-pelaaja";
    aiLabel.append(aiInput, aiText);

    row.append(label, aiLabel);
    els.nameFields.append(row);
  }
}

function normalizeCard(card) {
  if (!card || typeof card !== "object" || typeof card.id !== "string") return null;
  if (card.type === "number" && Number.isInteger(card.value) && card.value >= 0 && card.value <= 10) {
    return { type: "number", value: card.value, id: card.id };
  }
  if (card.type === "wild" && Object.prototype.hasOwnProperty.call(CARD_TEXT, card.kind)) {
    return { type: "wild", kind: card.kind, id: card.id };
  }
  return null;
}

function normalizeCardList(cards) {
  if (!Array.isArray(cards)) return null;
  const normalized = cards.map(normalizeCard);
  return normalized.every(Boolean) ? normalized : null;
}

function restoreGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_STORAGE_KEY));
    if (saved?.version !== GAME_STORAGE_VERSION || !saved.state) return false;

    const stored = saved.state;
    if (!Array.isArray(stored.players) || stored.players.length < 2 || stored.players.length > 6) return false;

    const players = stored.players.map((player) => {
      const hand = normalizeCardList(player?.hand);
      if (!hand || typeof player?.name !== "string" || !Number.isInteger(player.lives)) return null;
      return {
        name: player.name.slice(0, 18) || "Pelaaja",
        isAI: Boolean(player.isAI),
        lives: Math.min(5, Math.max(0, player.lives)),
        hand,
        eliminated: Boolean(player.eliminated)
      };
    });
    const drawPile = normalizeCardList(stored.drawPile);
    const discardPile = normalizeCardList(stored.discardPile);
    const currentIndex = Number(stored.currentIndex);
    const runningTotal = Number(stored.runningTotal);
    const direction = Number(stored.direction);
    const gameOver = Boolean(stored.gameOver);
    const activePlayers = players.filter((player) => player && !player.eliminated).length;
    if (
      players.some((player) => !player)
      || !drawPile
      || !discardPile
      || !Number.isInteger(currentIndex)
      || currentIndex < 0
      || currentIndex >= players.length
      || !Number.isFinite(runningTotal)
      || runningTotal < 0
      || runningTotal > 21
      || ![1, -1].includes(direction)
      || (gameOver ? activePlayers !== 1 : activePlayers < 2)
    ) {
      return false;
    }

    Object.assign(state, {
      players,
      drawPile,
      discardPile,
      runningTotal,
      currentIndex,
      direction,
      log: Array.isArray(stored.log)
        ? stored.log.filter((entry) => typeof entry === "string").slice(0, 50)
        : [],
      gameOver,
      turnLocked: true,
      turnNotice: null,
      pendingAiSummary: Array.isArray(stored.pendingAiSummary)
        ? stored.pendingAiSummary.filter((entry) => typeof entry === "string").slice(-6)
        : []
    });

    if (!state.gameOver && currentPlayer().eliminated) {
      state.currentIndex = nextActiveIndex(state.currentIndex, state.direction);
    }
    if (!state.gameOver) {
      state.turnNotice = {
        playerName: currentPlayer().name,
        reason: `Tallennettu peli palautettiin. ${currentPlayer().name} jatkaa vuoroaan.`,
        total: state.runningTotal,
        discard: labelFor(state.discardPile.at(-1)),
        direction: state.direction === 1 ? "Myötäpäivään" : "Vastapäivään"
      };
    }
    return true;
  } catch {
    return false;
  }
}

function saveGame() {
  if (state.players.length < 2) return;
  try {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({
      version: GAME_STORAGE_VERSION,
      state
    }));
  } catch {
    // Peli jatkuu muistissa, vaikka selaimen tallennustila ei olisi käytettävissä.
  }
}

function startGame(playerSettings) {
  cancelAiTurn();
  if (els.winnerDialog.open) els.winnerDialog.close();
  Object.assign(state, {
    players: playerSettings.map((setting, index) => {
      const normalized = typeof setting === "string" ? { name: setting, isAI: false } : setting;
      return {
        name: normalized?.name?.trim() || `Pelaaja ${index + 1}`,
        isAI: Boolean(normalized?.isAI),
        lives: 5,
        hand: [],
        eliminated: false
      };
    }),
    drawPile: makeDeck(),
    discardPile: [],
    runningTotal: 0,
    currentIndex: 0,
    direction: 1,
    log: [],
    gameOver: false,
    turnLocked: true,
    turnNotice: null,
    pendingAiSummary: []
  });

  for (let i = 0; i < 10; i += 1) {
    state.players.forEach((player) => player.hand.push(drawCard()));
  }

  let first = drawCard();
  let guard = 0;
  while (first?.type !== "number" && guard < 40) {
    state.drawPile.unshift(first);
    state.drawPile = shuffle(state.drawPile);
    first = drawCard();
    guard += 1;
  }
  state.discardPile.push(first);
  state.runningTotal = first?.value ?? 0;
  pushLog(`${state.players[0].name} aloittaa. Poistopakan ensimmäinen kortti on ${labelFor(first)}.`);
  lockTurn(`${state.players[0].name} aloittaa pelin. Poistopakan ensimmäinen kortti on ${labelFor(first)}, ja kokonaissumma on ${state.runningTotal}.`);
}

function drawCard() {
  if (state.drawPile.length === 0) {
    const top = state.discardPile.pop();
    state.drawPile = shuffle(state.discardPile);
    state.discardPile = top ? [top] : [];
    pushLog("Nostopakka sekoitettiin poistopakasta.");
  }
  return state.drawPile.pop();
}

function currentPlayer() {
  return state.players[state.currentIndex];
}

function alivePlayers() {
  return state.players.filter((player) => !player.eliminated);
}

function isPlayable(card) {
  if (state.gameOver) return false;
  if (card.type === "wild") return true;
  return state.runningTotal + card.value <= 21;
}

function hasPlayableCard(player) {
  return player.hand.some(isPlayable);
}

function cancelAiTurn() {
  aiTurnToken += 1;
  if (aiTimer !== null) {
    window.clearTimeout(aiTimer);
    aiTimer = null;
  }
}

function aiThreat(player) {
  if (!player || player.eliminated) return 0;
  return Math.max(0, 5 - player.hand.length) * 5 + Math.max(0, 3 - player.lives) * 2;
}

function aiCardScore(card, player) {
  const opponents = alivePlayers().filter((candidate) => candidate !== player);
  const nextPlayer = state.players[nextActiveIndex(state.currentIndex, state.direction)];
  const previousPlayer = state.players[nextActiveIndex(state.currentIndex, -state.direction)];
  const greatestThreat = Math.max(0, ...opponents.map(aiThreat));
  const remaining = player.hand.filter((candidate) => candidate.id !== card.id);
  let score = 20;

  if (player.hand.length === 1) return 1000;

  if (card.type === "number") {
    score += card.value * 2.2;
    if (state.runningTotal + card.value === 21) score += 34;
    if (card.value === 0) score -= 18;
    if (card.value <= 2) score -= 3;
    return score;
  }

  switch (card.kind) {
    case "draw2":
      return score + 18 + greatestThreat + opponents.length * 2;
    case "draw1":
      return score + 10 + greatestThreat * 0.75 + opponents.length;
    case "pass":
      return score + (state.runningTotal >= 17 ? 18 : 2);
    case "skip":
      if (opponents.length === 1) {
        return score + (remaining.some(isPlayable) ? 24 : -12);
      }
      return score + aiThreat(nextPlayer) * 1.6;
    case "reverse":
      if (opponents.length === 1) {
        return score + (remaining.some(isPlayable) ? 22 : -12);
      }
      return score + Math.max(0, aiThreat(previousPlayer) - aiThreat(nextPlayer)) * 1.8;
    case "eq21":
      return score + 30 + aiThreat(nextPlayer);
    case "eq10":
      return score + (state.runningTotal >= 17 ? 24 : state.runningTotal > 10 ? 10 : -4);
    case "eq0":
      return score + (state.runningTotal >= 18 ? 30 : state.runningTotal >= 14 ? 15 : -8);
    case "redeal": {
      const averageHand = alivePlayers().reduce((sum, candidate) => sum + candidate.hand.length, 0) / alivePlayers().length;
      const handPenalty = player.hand.length <= 2 ? -55 : 0;
      return score + (player.hand.length - averageHand) * 9 + (state.runningTotal >= 17 ? 9 : 0) + handPenalty;
    }
    case "bomb": {
      const vulnerable = opponents.filter((candidate) => candidate.lives <= 2).length;
      return score + 18 + opponents.length * 2 + vulnerable * 10 + (state.runningTotal >= 17 ? 8 : 0);
    }
    default:
      return score;
  }
}

function chooseAiCard(player) {
  const playable = player.hand.filter(isPlayable);
  if (playable.length === 0) return null;
  return playable
    .map((card) => ({ card, score: aiCardScore(card, player) + Math.random() * 2.5 }))
    .sort((a, b) => b.score - a.score)[0].card;
}

function rememberAiAction(reason) {
  state.pendingAiSummary.push(reason);
  state.pendingAiSummary = state.pendingAiSummary.slice(-6);
}

function scheduleAiTurn(delay = AI_REVEAL_DELAY) {
  cancelAiTurn();
  const player = currentPlayer();
  if (!player?.isAI || state.gameOver || els.setupDialog.open || els.rulesDialog.open || els.winnerDialog.open) return;
  const token = aiTurnToken;

  aiTimer = window.setTimeout(() => {
    if (token !== aiTurnToken || currentPlayer() !== player || state.gameOver) return;
    state.turnLocked = false;
    state.turnNotice = null;
    render();

    aiTimer = window.setTimeout(() => {
      aiTimer = null;
      if (token !== aiTurnToken || currentPlayer() !== player || state.gameOver || state.turnLocked) return;
      const card = chooseAiCard(player);
      if (card) {
        playCard(card.id);
      } else {
        takeLifeForCurrentPlayer();
      }
    }, AI_PLAY_DELAY);
  }, delay);
}

function resumeCurrentTurn() {
  if (state.gameOver || state.players.length < 2) return;
  if (currentPlayer().isAI) {
    scheduleAiTurn();
  } else if (state.turnLocked) {
    window.setTimeout(showTurnDialog, 0);
  }
}

function playCard(cardId) {
  if (state.gameOver || state.turnLocked) return;
  const player = currentPlayer();
  const index = player.hand.findIndex((card) => card.id === cardId);
  if (index === -1) return;
  const card = player.hand[index];
  if (!isPlayable(card)) return;

  player.hand.splice(index, 1);
  const wasLastCard = player.hand.length === 0;
  state.discardPile.push(card);
  pushLog(`${player.name} pelasi ${labelFor(card)}.`);

  if (card.type === "number") {
    state.runningTotal += card.value;
    finishCardPlay(player, card, 1, wasLastCard);
    return;
  }

  const effect = applyWild(card, player);
  finishCardPlay(player, card, effect.steps, wasLastCard, effect.detail);
}

function finishCardPlay(player, card, stepOverride, wasLastCard, effectDetail = "") {
  if (wasLastCard) {
    if (player.isAI) {
      rememberAiAction(`${player.name} pelasi viimeisen korttinsa ${labelFor(card)} ja voitti jaon.`);
    }
    completeHand(player);
    return;
  }
  if (checkWinner()) {
    render();
    return;
  }
  const previousIndex = state.currentIndex;
  const turnMove = advanceTurn(stepOverride);
  const reason = turnReason(player, card, turnMove, effectDetail);
  if (player.isAI) rememberAiAction(reason);
  if (state.currentIndex !== previousIndex) {
    lockTurn(reason);
  } else {
    render();
    if (player.isAI) scheduleAiTurn(AI_PLAY_DELAY);
  }
}

function applyWild(card, player) {
  switch (card.kind) {
    case "draw1":
      return { steps: 1, detail: drawForOthers(player, 1) };
    case "draw2":
      return { steps: 1, detail: drawForOthers(player, 2) };
    case "pass":
      return { steps: 1, detail: "Vuoro siirtyi eteenpäin ja kokonaissumma säilyi ennallaan." };
    case "reverse":
      state.direction *= -1;
      return {
        steps: alivePlayers().length === 2 ? 0 : 1,
        detail: `Pelin suunta vaihtui ${state.direction === 1 ? "myötäpäivään" : "vastapäivään"}.`
      };
    case "skip":
      return { steps: alivePlayers().length === 2 ? 0 : 2, detail: "" };
    case "eq21":
      state.runningTotal = 21;
      return { steps: 1, detail: "Kokonaissummaksi asetettiin 21." };
    case "eq10":
      state.runningTotal = 10;
      return { steps: 1, detail: "Kokonaissummaksi asetettiin 10." };
    case "eq0":
      state.runningTotal = 0;
      return { steps: 1, detail: "Kokonaissumma nollattiin." };
    case "redeal":
      {
        const detail = redealHands(player);
        state.runningTotal = 0;
        return { steps: 1, detail };
      }
    case "bomb":
      {
        const detail = resolveBomb(player);
        state.runningTotal = 0;
        return { steps: 1, detail };
      }
    default:
      return { steps: 1, detail: "" };
  }
}

function drawForOthers(sourcePlayer, amount) {
  const outcomes = [];
  state.players.forEach((player) => {
    if (player === sourcePlayer || player.eliminated) return;
    let drawn = 0;
    for (let i = 0; i < amount; i += 1) {
      const card = drawCard();
      if (card) {
        player.hand.push(card);
        drawn += 1;
      }
    }
    outcomes.push(`${player.name} nosti ${drawn} kort${drawn === 1 ? "in" : "tia"}.`);
  });
  const detail = outcomes.join(" ");
  pushLog(detail);
  return detail;
}

function redealHands(sourcePlayer) {
  const active = state.players.filter((player) => !player.eliminated);
  const pool = shuffle(active.flatMap((player) => player.hand.splice(0)));
  let dealIndex = nextActiveIndex(state.currentIndex, 1);
  while (pool.length) {
    state.players[dealIndex].hand.push(pool.pop());
    dealIndex = nextActiveIndex(dealIndex, 1);
  }
  const counts = active.map((player) => `${player.name}: ${player.hand.length}`).join(", ");
  const detail = `Käsikortit sekoitettiin ja jaettiin uudelleen (${counts}). Kokonaissumma nollattiin.`;
  pushLog(`${sourcePlayer.name} pelasi Uusi jako -kortin. ${detail}`);
  return detail;
}

function resolveBomb(sourcePlayer) {
  const outcomes = [];
  state.players.forEach((player) => {
    if (player === sourcePlayer || player.eliminated) return;
    const zeroIndex = player.hand.findIndex((card) => card.type === "number" && card.value === 0);
    if (zeroIndex >= 0) {
      const [zero] = player.hand.splice(zeroIndex, 1);
      state.discardPile.push(zero);
      pushLog(`${player.name} poisti 0-kortin pommiin.`);
      outcomes.push(`${player.name} poisti 0-kortin.`);
    } else {
      loseLife(player, "ei pystynyt poistamaan 0-korttia pommiin");
      outcomes.push(
        player.eliminated
          ? `${player.name} menetti elämän ja putosi pelistä.`
          : `${player.name} menetti elämän (${player.lives} jäljellä).`
      );
    }
  });
  return `${outcomes.join(" ")} Kokonaissumma nollattiin.`;
}

function completeHand(winnerOfHand) {
  pushLog(`${winnerOfHand.name} pelasi viimeisen korttinsa. Muut menettävät elämän.`);
  state.players.forEach((player) => {
    if (player !== winnerOfHand && !player.eliminated) {
      loseLife(player, "jäi kortteja käteen jaon lopussa");
    }
  });
  if (checkWinner()) {
    render();
    return;
  }
  beginNewHand(winnerOfHand);
}

function beginNewHand(starter) {
  const names = state.players.map((player) => ({
    name: player.name,
    lives: player.lives,
    eliminated: player.eliminated
  }));
  state.drawPile = makeDeck();
  state.discardPile = [];
  state.runningTotal = 0;
  state.direction = 1;
  state.players.forEach((player, index) => {
    player.hand = [];
    player.lives = names[index].lives;
    player.eliminated = names[index].eliminated;
  });
  for (let i = 0; i < 10; i += 1) {
    state.players.forEach((player) => {
      if (!player.eliminated) player.hand.push(drawCard());
    });
  }
  let first = drawCard();
  while (first?.type !== "number") {
    state.drawPile.unshift(first);
    state.drawPile = shuffle(state.drawPile);
    first = drawCard();
  }
  state.discardPile.push(first);
  state.runningTotal = first.value;
  state.currentIndex = state.players.indexOf(starter);
  if (state.players[state.currentIndex].eliminated) {
    state.currentIndex = nextActiveIndex(state.currentIndex, 1);
  }
  pushLog("Uusi jako alkoi.");
  lockTurn(`Uusi jako alkoi. ${currentPlayer().name} jatkaa, kokonaissumma on ${state.runningTotal}.`);
}

function takeLifeForCurrentPlayer() {
  if (state.gameOver || state.turnLocked) return;
  const player = currentPlayer();
  if (hasPlayableCard(player)) {
    pushLog(`${player.name} voi vielä pelata jonkin kortin.`);
    render();
    return;
  }
  loseLife(player, "ei voinut pelata ylittämättä 21:tä");
  state.runningTotal = 0;
  if (!checkWinner()) {
    advanceTurn(1);
    const reason = `${player.name} menetti elämän, koska mikään kortti ei mahtunut alle 22:n. Summa nollattiin.`;
    if (player.isAI) rememberAiAction(reason);
    lockTurn(reason);
  } else {
    render();
  }
}

function loseLife(player, reason) {
  player.lives = Math.max(0, player.lives - 1);
  pushLog(`${player.name} menetti elämän: ${reason}.`);
  if (player.lives === 0) {
    player.eliminated = true;
    player.hand = [];
    pushLog(`${player.name} putosi pelistä.`);
  }
}

function advanceTurn(steps) {
  if (state.gameOver) return { skipped: [] };
  let index = state.currentIndex;
  const amount = Math.max(0, steps);
  if (amount === 0) {
    return { skipped: [] };
  }
  const visited = [];
  for (let i = 0; i < amount; i += 1) {
    index = nextActiveIndex(index, state.direction);
    visited.push(index);
  }
  state.currentIndex = index;
  return { skipped: visited.slice(0, -1).map((playerIndex) => state.players[playerIndex].name) };
}

function nextActiveIndex(fromIndex, direction) {
  let index = fromIndex;
  for (let guard = 0; guard < state.players.length * 2; guard += 1) {
    index = (index + direction + state.players.length) % state.players.length;
    if (!state.players[index].eliminated) return index;
  }
  return fromIndex;
}

function checkWinner() {
  const alive = alivePlayers();
  if (alive.length === 1) {
    const wasGameOver = state.gameOver;
    state.gameOver = true;
    if (!wasGameOver) pushLog(`${alive[0].name} voitti pelin!`);
    return true;
  }
  return false;
}

function pushLog(text) {
  state.log.unshift(text);
  state.log = state.log.slice(0, 50);
}

function lockTurn(reason) {
  if (state.gameOver) return;
  cancelAiTurn();
  state.turnLocked = true;
  const player = currentPlayer();
  const noticeReason = !player.isAI && state.pendingAiSummary.length
    ? state.pendingAiSummary.join(" ")
    : reason;
  state.turnNotice = {
    playerName: player.name,
    reason: noticeReason,
    total: state.runningTotal,
    discard: labelFor(state.discardPile.at(-1)),
    direction: state.direction === 1 ? "Myötäpäivään" : "Vastapäivään"
  };
  render();
  if (player.isAI) {
    scheduleAiTurn();
  } else {
    window.setTimeout(showTurnDialog, 0);
  }
}

function showTurnDialog() {
  if (!state.turnLocked || state.gameOver || !state.turnNotice || currentPlayer()?.isAI) return;
  els.turnDialogTitle.textContent = `${state.turnNotice.playerName}, sinun vuorosi`;
  els.turnDialogReason.textContent = state.turnNotice.reason;
  els.turnDialogTotal.textContent = state.turnNotice.total;
  els.turnDialogDiscard.textContent = state.turnNotice.discard;
  els.turnDialogDirection.textContent = state.turnNotice.direction;
  if (!els.turnDialog.open) {
    els.turnDialog.showModal();
  }
}

function showWinnerDialog() {
  if (!state.gameOver || els.winnerDialog.open) return;
  const winner = alivePlayers()[0];
  if (!winner) return;
  els.winnerDialogTitle.textContent = `${winner.name} voitti!`;
  els.winnerDialogSummary.textContent = `${winner.name} jäi viimeiseksi pelaajaksi, jolla on elämää jäljellä.`;
  els.winnerDialog.showModal();
}

function revealTurn() {
  cancelAiTurn();
  state.turnLocked = false;
  state.turnNotice = null;
  state.pendingAiSummary = [];
  render();
}

function turnReason(player, card, turnMove, effectDetail = "") {
  const cardName = labelFor(card);
  const skipped = turnMove.skipped.length ? ` ${turnMove.skipped.join(", ")} ohitettiin.` : "";
  if (card.type === "number") {
    return `${player.name} pelasi numerokortin ${cardName}. Kokonaissumma on nyt ${state.runningTotal}.${skipped}`;
  }
  if (card.kind === "skip") {
    const skipDetail = turnMove.skipped.length
      ? `${turnMove.skipped.join(", ")} ohitettiin.`
      : `Kahden pelaajan pelissä ${player.name} saa uuden vuoron.`;
    return `${player.name} pelasi erikoiskortin ${cardName}. ${skipDetail}`;
  }
  return `${player.name} pelasi erikoiskortin ${cardName}. ${effectDetail}${skipped}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function labelFor(card) {
  if (!card) return "-";
  if (card.type === "number") return `${card.value}`;
  return CARD_TEXT[card.kind][0];
}

function cardElement(card, asButton = false) {
  const node = document.createElement(asButton ? "button" : "div");
  node.className = `${asButton ? "card-button" : "mini-card"} ${card?.type === "number" ? "card-number" : "card-wild"} ${card?.kind ? `card-${card.kind}` : ""}`;
  if (!card) {
    node.innerHTML = "<span class=\"card-type\">Tyhjä</span><strong class=\"card-value\">-</strong><span class=\"card-desc\">Ei korttia</span>";
    return node;
  }
  const label = card.type === "number" ? ["Numero", String(card.value), `Lisää ${card.value}`] : CARD_TEXT[card.kind];
  node.innerHTML = `<span class="card-type">${label[0]}</span><strong class="card-value">${label[1]}</strong><span class="card-desc">${label[2]}</span>`;
  return node;
}

function render() {
  const player = currentPlayer();
  const winner = state.gameOver ? alivePlayers()[0] : null;

  els.playersBoard.innerHTML = "";
  state.players.forEach((p, index) => {
    const tile = document.createElement("article");
    tile.className = `player-tile ${p.isAI ? "ai" : ""} ${index === state.currentIndex && !state.gameOver ? "active" : ""} ${p.eliminated ? "out" : ""}`;
    tile.innerHTML = `
      <span class="player-number" title="${escapeHtml(p.name)}${p.isAI ? " (AI)" : ""}">${index + 1}</span>
      <div class="life-row" aria-label="${p.lives} elämää">
        ${Array.from({ length: 5 }, (_, i) => `<span class="life ${i >= p.lives ? "lost" : ""}"></span>`).join("")}
      </div>
      <span class="cards-count" aria-label="${p.hand.length} käsikorttia"><span class="cards-icon"></span>${p.hand.length}</span>
    `;
    els.playersBoard.append(tile);
  });

  els.drawCount.textContent = state.drawPile.length;
  els.runningTotal.textContent = state.runningTotal;
  els.discardCard.replaceChildren(cardElement(state.discardPile.at(-1), false));
  els.directionLabel.textContent = state.direction === 1 ? "Myötäpäivään" : "Vastapäivään";
  els.currentPlayerLabel.textContent = state.gameOver ? "-" : `${player?.name ?? "-"}${player?.isAI ? " (AI)" : ""}`;
  els.turnTitle.textContent = state.gameOver ? `${winner.name} voitti` : `${player.name}${player.isAI ? " (AI)" : ""} pelaa`;
  els.stateText.textContent = state.gameOver
    ? `Peli päättyi. Voittaja on ${winner.name}.`
    : player.isAI
      ? `${player.name} on AI-pelaaja ja valitsee korttia automaattisesti.`
    : state.turnLocked
      ? `${player.name} on vuorossa. Käsi on piilossa, kunnes pelaaja aloittaa vuoronsa.`
      : `${player.name}: pelaa kortti tai menetä elämä, jos mikään kortti ei käy.`;
  els.handHint.textContent = state.gameOver
    ? "Peli on päättynyt."
    : player.isAI
      ? `${player.name} miettii siirtoa.`
    : state.turnLocked
      ? "Käsi on piilossa vuoronvaihdon ajan."
      : `Vuorossa ${player.name}.`;

  els.hand.innerHTML = "";
  if (player && !player.isAI && !state.gameOver && !state.turnLocked) {
    player.hand.forEach((card) => {
      const button = cardElement(card, true);
      button.type = "button";
      button.disabled = !isPlayable(card);
      button.addEventListener("click", () => playCard(card.id));
      els.hand.append(button);
    });
  } else if (player && !state.gameOver) {
    const hidden = document.createElement("div");
    hidden.className = "hand-cover";
    hidden.innerHTML = player.isAI
      ? `<strong>${escapeHtml(player.name)} miettii siirtoa</strong><span>AI-pelaajan käsi pysyy piilossa.</span>`
      : `<strong>${escapeHtml(player.name)} valmistautuu vuoroon</strong><span>Kortit näytetään vasta, kun vuoro aloitetaan.</span>`;
    els.hand.append(hidden);
  }

  els.takeLifeButton.disabled = state.gameOver || state.turnLocked || player?.isAI;
  els.log.innerHTML = state.log
    .map((entry, index) => `<article class="log-entry"><span>${index === 0 ? "Uusin" : index + 1}</span><p>${escapeHtml(entry)}</p></article>`)
    .join("");
  saveGame();
  if (state.gameOver) window.setTimeout(showWinnerDialog, 0);
}

els.playerCount.addEventListener("change", buildNameFields);
els.setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const playerSettings = [...els.nameFields.querySelectorAll(".player-setup")]
    .map((row, index) => ({
      name: row.querySelector(".player-name-field input").value.trim() || `Pelaaja ${index + 1}`,
      isAI: row.querySelector(".ai-toggle input").checked
    }));
  els.setupDialog.close();
  startGame(playerSettings);
});
els.takeLifeButton.addEventListener("click", takeLifeForCurrentPlayer);
els.turnForm.addEventListener("submit", (event) => {
  event.preventDefault();
  els.turnDialog.close();
  revealTurn();
});
els.newGameButton.addEventListener("click", () => {
  cancelAiTurn();
  buildNameFields();
  els.setupDialog.showModal();
});
els.helpButton.addEventListener("click", () => {
  cancelAiTurn();
  els.rulesDialog.showModal();
});
els.rulesDialog.addEventListener("close", resumeCurrentTurn);
els.setupDialog.addEventListener("close", resumeCurrentTurn);
els.winnerNewGameButton.addEventListener("click", () => {
  cancelAiTurn();
  els.winnerDialog.close();
  buildNameFields();
  els.setupDialog.showModal();
});

buildNameFields();
if (restoreGame()) {
  render();
  if (currentPlayer().isAI) {
    scheduleAiTurn();
  } else {
    window.setTimeout(showTurnDialog, 0);
  }
} else {
  els.setupDialog.showModal();
}
