const levelCounts = [6, 8, 10, 12, 14];
const symbols = [
  { icon: '🌍', hue: 200 },
  { icon: '🪐', hue: 270 },
  { icon: '🚀', hue: 8 },
  { icon: '👽', hue: 125 },
  { icon: '🌙', hue: 45 },
  { icon: '☄️', hue: 330 },
  { icon: '🛰️', hue: 185 },
];

const board = document.querySelector('#board');
const levelElement = document.querySelector('#level');
const cardCountElement = document.querySelector('#card-count');
const scoreElement = document.querySelector('#score');
const movesElement = document.querySelector('#moves');
const timerElement = document.querySelector('#timer');
const statusElement = document.querySelector('#status');
const progressBar = document.querySelector('#progress-bar');
const overlay = document.querySelector('#overlay');
const resultIcon = document.querySelector('#result-icon');
const resultTitle = document.querySelector('#result-title');
const resultMessage = document.querySelector('#result-message');
const nextLevelButton = document.querySelector('#next-level');
const restartButton = document.querySelector('#restart');
const rankingForm = document.querySelector('#ranking-form');
const playerNameInput = document.querySelector('#player-name');
const rankingView = document.querySelector('#ranking-view');
const rankingList = document.querySelector('#ranking');
const playAgainButton = document.querySelector('#play-again');

let currentLevel = 0;
let score = 0;
let moves = 0;
let matchedPairs = 0;
let firstCard = null;
let secondCard = null;
let boardLocked = false;
let compareTimer = null;
let totalElapsedMs = 0;
let levelStartedAt = null;
const rankingKey = 'cardMemoryTimeRanking';

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function createDeck(cardCount) {
  const pairCount = cardCount / 2;
  const pairs = symbols.slice(0, pairCount).flatMap((symbol, pairIndex) => [
    { ...symbol, pairIndex, id: `${pairIndex}-a` },
    { ...symbol, pairIndex, id: `${pairIndex}-b` },
  ]);
  return shuffle(pairs);
}

function createCard(cardData, position) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.dataset.pair = String(cardData.pairIndex);
  card.dataset.position = String(position);
  card.setAttribute('aria-label', `第 ${position + 1} 張卡牌，尚未翻開`);
  card.innerHTML = `
    <span class="card-inner">
      <span class="card-face card-back" aria-hidden="true"></span>
      <span class="card-face card-front" style="--hue:${cardData.hue}" aria-hidden="true">
        <span class="symbol">${cardData.icon}</span>
      </span>
    </span>`;
  card.addEventListener('click', () => flipCard(card, cardData.icon));
  return card;
}

function startLevel() {
  clearTimeout(compareTimer);
  const cardCount = levelCounts[currentLevel];
  board.replaceChildren();
  firstCard = null;
  secondCard = null;
  boardLocked = false;
  matchedPairs = 0;
  levelStartedAt = null;
  createDeck(cardCount).forEach((cardData, index) => {
    board.append(createCard(cardData, index));
  });
  overlay.hidden = true;
  statusElement.textContent = '請翻開兩張卡牌';
  updateHud();
  updateTimer();
}

function flipCard(card, icon) {
  if (boardLocked || card === firstCard || card.classList.contains('matched')) return;
  if (levelStartedAt === null) levelStartedAt = performance.now();
  card.classList.add('flipped');
  card.setAttribute('aria-label', `已翻開：${icon}`);

  if (!firstCard) {
    firstCard = card;
    statusElement.textContent = '再選擇一張卡牌';
    return;
  }

  secondCard = card;
  moves += 1;
  boardLocked = true;
  const matched = firstCard.dataset.pair === secondCard.dataset.pair;
  if (matched) handleMatch();
  else handleMismatch();
  updateHud();
}

function handleMatch() {
  firstCard.classList.add('matched');
  secondCard.classList.add('matched');
  firstCard.disabled = true;
  secondCard.disabled = true;
  matchedPairs += 1;
  score += 100 + currentLevel * 25;
  statusElement.textContent = '配對成功，獲得分數！';
  resetTurn();

  if (matchedPairs === levelCounts[currentLevel] / 2) {
    compareTimer = window.setTimeout(showLevelResult, 650);
  }
}

function handleMismatch() {
  statusElement.textContent = '圖案不同，再試一次';
  compareTimer = window.setTimeout(() => {
    [firstCard, secondCard].forEach(card => {
      card.classList.remove('flipped');
      card.setAttribute('aria-label', `第 ${Number(card.dataset.position) + 1} 張卡牌，尚未翻開`);
    });
    resetTurn();
    statusElement.textContent = '請翻開兩張卡牌';
  }, 850);
}

function resetTurn() {
  firstCard = null;
  secondCard = null;
  boardLocked = false;
}

function showLevelResult() {
  stopLevelTimer();
  const isFinalLevel = currentLevel === levelCounts.length - 1;
  overlay.hidden = false;
  rankingForm.hidden = true;
  rankingView.hidden = true;
  if (isFinalLevel) {
    resultIcon.textContent = '🏆';
    resultTitle.textContent = '五個關卡全部完成！';
    resultMessage.textContent = `完成時間 ${formatTime(totalElapsedMs)}，共翻牌 ${moves} 次。`;
    nextLevelButton.hidden = true;
    rankingForm.hidden = false;
    playerNameInput.value = '';
    playerNameInput.focus();
  } else {
    resultIcon.textContent = '🚀';
    resultTitle.textContent = `第 ${currentLevel + 1} 關完成！`;
    resultMessage.textContent = `目前累積時間 ${formatTime(totalElapsedMs)}，下一關有 ${levelCounts[currentLevel + 1]} 張卡牌。`;
    nextLevelButton.hidden = false;
    nextLevelButton.textContent = '進入下一關';
    nextLevelButton.focus();
  }
}

function advanceLevel() {
  currentLevel += 1;
  startLevel();
}

function restartGame() {
  currentLevel = 0;
  score = 0;
  moves = 0;
  totalElapsedMs = 0;
  levelStartedAt = null;
  startLevel();
}

function stopLevelTimer() {
  if (levelStartedAt !== null) {
    totalElapsedMs += performance.now() - levelStartedAt;
    levelStartedAt = null;
  }
  updateTimer();
}

function elapsedTime() {
  return totalElapsedMs + (levelStartedAt === null ? 0 : performance.now() - levelStartedAt);
}

function formatTime(milliseconds) {
  const totalTenths = Math.floor(milliseconds / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function updateTimer() {
  timerElement.textContent = formatTime(elapsedTime());
}

function loadRanking() {
  try {
    return JSON.parse(localStorage.getItem(rankingKey)) || [];
  } catch {
    return [];
  }
}

function saveTime(name) {
  const entries = loadRanking();
  const newEntry = { name: name.slice(0, 12), timeMs: Math.round(totalElapsedMs), createdAt: Date.now() };
  entries.push(newEntry);
  entries.sort((a, b) => a.timeMs - b.timeMs || a.createdAt - b.createdAt);
  const rank = entries.indexOf(newEntry) + 1;
  const topTen = entries.slice(0, 10);
  localStorage.setItem(rankingKey, JSON.stringify(topTen));
  return { topTen, rank };
}

function showRanking(entries, rank) {
  rankingForm.hidden = true;
  rankingView.hidden = false;
  resultTitle.textContent = rank <= 10 ? `成功進入第 ${rank} 名！` : `本次排名第 ${rank} 名`;
  resultMessage.textContent = rank <= 10 ? '你的時間已加入前 10 名。' : '這次尚未進入前 10 名，再挑戰一次吧！';
  rankingList.replaceChildren();
  entries.forEach((entry, index) => {
    const item = document.createElement('li');
    const rankElement = document.createElement('span');
    rankElement.className = 'rank';
    rankElement.textContent = `#${index + 1}`;
    const nameElement = document.createElement('span');
    nameElement.textContent = entry.name;
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTime(entry.timeMs);
    item.append(rankElement, nameElement, time);
    rankingList.append(item);
  });
  playAgainButton.focus();
}

function updateHud() {
  levelElement.textContent = `${currentLevel + 1} / ${levelCounts.length}`;
  cardCountElement.textContent = `${levelCounts[currentLevel]} 張`;
  scoreElement.textContent = String(score);
  movesElement.textContent = String(moves);
  progressBar.style.width = `${((currentLevel + matchedPairs / (levelCounts[currentLevel] / 2)) / levelCounts.length) * 100}%`;
}

nextLevelButton.addEventListener('click', advanceLevel);
restartButton.addEventListener('click', restartGame);
playAgainButton.addEventListener('click', restartGame);
rankingForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) return;
  const result = saveTime(name);
  showRanking(result.topTen, result.rank);
});
startLevel();
window.setInterval(updateTimer, 100);
