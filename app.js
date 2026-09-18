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
  turnNotice: null
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
  turnDialogDirection: document.querySelector("#turnDialogDirection")
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
    const label = document.createElement("label");
    label.textContent = `Pelaaja ${i + 1}`;
    const input = document.createElement("input");
    input.name = `player-${i}`;
    input.maxLength = 18;
    input.value = `Pelaaja ${i + 1}`;
    label.append(input);
    els.nameFields.append(label);
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
      turnNotice: null
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

function startGame(names) {
  Object.assign(state, {
    players: names.map((name) => ({ name, lives: 5, hand: [], eliminated: false })),
    drawPile: makeDeck(),
    discardPile: [],
    runningTotal: 0,
    currentIndex: 0,
    direction: 1,
    log: [],
    gameOver: false,
    turnLocked: true,
    turnNotice: null
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

  const stepOverride = applyWild(card, player);
  finishCardPlay(player, card, stepOverride, wasLastCard);
}

function finishCardPlay(player, card, stepOverride, wasLastCard) {
  if (wasLastCard) {
    completeHand(player);
    return;
  }
  if (checkWinner()) {
    render();
    return;
  }
  const previousIndex = state.currentIndex;
  const turnMove = advanceTurn(stepOverride);
  if (state.currentIndex !== previousIndex) {
    lockTurn(turnReason(player, card, turnMove));
  } else {
    render();
  }
}

function applyWild(card, player) {
  switch (card.kind) {
    case "draw1":
      drawForOthers(player, 1);
      return 1;
    case "draw2":
      drawForOthers(player, 2);
      return 1;
    case "pass":
      return 1;
    case "reverse":
      state.direction *= -1;
      return alivePlayers().length === 2 ? 0 : 1;
    case "skip":
      return alivePlayers().length === 2 ? 0 : 2;
    case "eq21":
      state.runningTotal = 21;
      return 1;
    case "eq10":
      state.runningTotal = 10;
      return 1;
    case "eq0":
      state.runningTotal = 0;
      return 1;
    case "redeal":
      redealHands(player);
      state.runningTotal = 0;
      return 1;
    case "bomb":
      resolveBomb(player);
      state.runningTotal = 0;
      return 1;
    default:
      return 1;
  }
}

function drawForOthers(sourcePlayer, amount) {
  state.players.forEach((player) => {
    if (player === sourcePlayer || player.eliminated) return;
    for (let i = 0; i < amount; i += 1) {
      const card = drawCard();
      if (card) player.hand.push(card);
    }
  });
  pushLog(`Kaikki muut nostivat ${amount} kort${amount === 1 ? "in" : "tia"}.`);
}

function redealHands(sourcePlayer) {
  const active = state.players.filter((player) => !player.eliminated);
  const pool = shuffle(active.flatMap((player) => player.hand.splice(0)));
  let dealIndex = nextActiveIndex(state.currentIndex, 1);
  while (pool.length) {
    state.players[dealIndex].hand.push(pool.pop());
    dealIndex = nextActiveIndex(dealIndex, 1);
  }
  pushLog(`${sourcePlayer.name} sekoitti ja jakoi pelaajien käsikortit uudelleen.`);
}

function resolveBomb(sourcePlayer) {
  state.players.forEach((player) => {
    if (player === sourcePlayer || player.eliminated) return;
    const zeroIndex = player.hand.findIndex((card) => card.type === "number" && card.value === 0);
    if (zeroIndex >= 0) {
      const [zero] = player.hand.splice(zeroIndex, 1);
      state.discardPile.push(zero);
      pushLog(`${player.name} poisti 0-kortin pommiin.`);
    } else {
      loseLife(player, "ei pystynyt poistamaan 0-korttia pommiin");
    }
  });
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
    lockTurn(`${player.name} menetti elämän, koska mikään kortti ei mahtunut alle 22:n. Summa nollattiin.`);
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
    state.gameOver = true;
    pushLog(`${alive[0].name} voitti pelin!`);
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
  state.turnLocked = true;
  state.turnNotice = {
    playerName: currentPlayer().name,
    reason,
    total: state.runningTotal,
    discard: labelFor(state.discardPile.at(-1)),
    direction: state.direction === 1 ? "Myötäpäivään" : "Vastapäivään"
  };
  render();
  window.setTimeout(showTurnDialog, 0);
}

function showTurnDialog() {
  if (!state.turnLocked || state.gameOver || !state.turnNotice) return;
  els.turnDialogTitle.textContent = `${state.turnNotice.playerName}, sinun vuorosi`;
  els.turnDialogReason.textContent = state.turnNotice.reason;
  els.turnDialogTotal.textContent = state.turnNotice.total;
  els.turnDialogDiscard.textContent = state.turnNotice.discard;
  els.turnDialogDirection.textContent = state.turnNotice.direction;
  if (!els.turnDialog.open) {
    els.turnDialog.showModal();
  }
}

function revealTurn() {
  state.turnLocked = false;
  state.turnNotice = null;
  render();
}

function turnReason(player, card, turnMove) {
  const cardName = labelFor(card);
  const skipped = turnMove.skipped.length ? ` ${turnMove.skipped.join(", ")} ohitettiin.` : "";
  if (card.type === "number") {
    return `${player.name} pelasi numerokortin ${cardName}. Kokonaissumma on nyt ${state.runningTotal}.${skipped}`;
  }
  const wildReason = {
    draw1: "Muut pelaajat nostivat yhden kortin.",
    draw2: "Muut pelaajat nostivat kaksi korttia.",
    pass: "Kortti siirsi vuoron eteenpäin muuttamatta summaa.",
    reverse: "Pelin suunta vaihtui.",
    skip: turnMove.skipped.length ? "Seuraavan pelaajan vuoro ohitettiin." : "Kahden pelaajan pelissä kortin pelannut saa uuden vuoron.",
    eq21: "Kokonaissummaksi asetettiin 21.",
    eq10: "Kokonaissummaksi asetettiin 10.",
    eq0: "Kokonaissumma nollattiin.",
    redeal: "Kaikkien käsikortit sekoitettiin ja jaettiin uudelleen.",
    bomb: "Muiden piti poistaa 0-kortti tai menettää elämä."
  };
  return `${player.name} pelasi villin kortin ${cardName}. ${wildReason[card.kind]}${skipped}`;
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
  node.className = `${asButton ? "card-button" : "mini-card"} ${card?.type === "wild" ? "card-wild" : ""} ${card?.kind ? `card-${card.kind}` : ""}`;
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
    tile.className = `player-tile ${index === state.currentIndex && !state.gameOver ? "active" : ""} ${p.eliminated ? "out" : ""}`;
    tile.innerHTML = `
      <span class="player-number" title="${escapeHtml(p.name)}">${index + 1}</span>
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
  els.currentPlayerLabel.textContent = state.gameOver ? "-" : player?.name ?? "-";
  els.turnTitle.textContent = state.gameOver ? `${winner.name} voitti` : `${player.name} pelaa`;
  els.stateText.textContent = state.gameOver
    ? `Peli päättyi. Voittaja on ${winner.name}.`
    : state.turnLocked
      ? `${player.name} on vuorossa. Käsi on piilossa, kunnes pelaaja aloittaa vuoronsa.`
      : `${player.name}: pelaa kortti tai menetä elämä, jos mikään kortti ei käy.`;
  els.handHint.textContent = state.gameOver
    ? "Peli on päättynyt."
    : state.turnLocked
      ? "Käsi on piilossa vuoronvaihdon ajan."
      : `Vuorossa ${player.name}.`;

  els.hand.innerHTML = "";
  if (player && !state.gameOver && !state.turnLocked) {
    player.hand.forEach((card) => {
      const button = cardElement(card, true);
      button.type = "button";
      button.disabled = !isPlayable(card);
      button.addEventListener("click", () => playCard(card.id));
      els.hand.append(button);
    });
  } else if (player && state.turnLocked && !state.gameOver) {
    const hidden = document.createElement("div");
    hidden.className = "hand-cover";
    hidden.innerHTML = `<strong>${escapeHtml(player.name)} valmistautuu vuoroon</strong><span>Kortit näytetään vasta, kun vuoro aloitetaan.</span>`;
    els.hand.append(hidden);
  }

  els.takeLifeButton.disabled = state.gameOver || state.turnLocked;
  els.log.innerHTML = state.log
    .map((entry, index) => `<article class="log-entry"><span>${index === 0 ? "Uusin" : index + 1}</span><p>${escapeHtml(entry)}</p></article>`)
    .join("");
  saveGame();
}

els.playerCount.addEventListener("change", buildNameFields);
els.setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const names = [...els.nameFields.querySelectorAll("input")]
    .map((input, index) => input.value.trim() || `Pelaaja ${index + 1}`);
  els.setupDialog.close();
  startGame(names);
});
els.takeLifeButton.addEventListener("click", takeLifeForCurrentPlayer);
els.turnForm.addEventListener("submit", (event) => {
  event.preventDefault();
  els.turnDialog.close();
  revealTurn();
});
els.newGameButton.addEventListener("click", () => {
  buildNameFields();
  els.setupDialog.showModal();
});
els.helpButton.addEventListener("click", () => els.rulesDialog.showModal());

buildNameFields();
if (restoreGame()) {
  render();
  window.setTimeout(showTurnDialog, 0);
} else {
  els.setupDialog.showModal();
}
