const canvas = document.querySelector('#myCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.querySelector('#myScore');
const highestScoreElement = document.querySelector('#myHighestScore');
const restartButton = document.querySelector('#Start');

const unit = 20;
const rows = canvas.height / unit;
const columns = canvas.width / unit;
const directions = {
  Right: { x: 1, y: 0 },
  Down: { x: 0, y: 1 },
  Left: { x: -1, y: 0 },
  Up: { x: 0, y: -1 },
};

let snake;
let fruit;
let direction;
let nextDirection;
let score;
let highestScore = Number(localStorage.getItem('highestScore')) || 0;
let timer;
let paused = false;
let gameOver = false;

class Fruit {
  constructor() {
    this.pickLocation();
  }

  pickLocation() {
    do {
      this.x = Math.floor(Math.random() * columns) * unit;
      this.y = Math.floor(Math.random() * rows) * unit;
    } while (snake.some(segment => segment.x === this.x && segment.y === this.y));
  }

  draw() {
    const cx = this.x + unit / 2;
    const cy = this.y + unit / 2 + 1;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;

    const apple = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, 11);
    apple.addColorStop(0, '#ff8b86');
    apple.addColorStop(.42, '#ef3f48');
    apple.addColorStop(1, '#9d1727');
    ctx.fillStyle = apple;
    ctx.beginPath();
    ctx.arc(cx - 4, cy, 7, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy, 7, 0, Math.PI * 2);
    ctx.arc(cx, cy + 4, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#6d3a20';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.quadraticCurveTo(cx + 1, cy - 11, cx + 4, cy - 12);
    ctx.stroke();

    ctx.fillStyle = '#55b95b';
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy - 9, 5, 2.5, -.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 3, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function startGame() {
  clearInterval(timer);
  snake = [
    { x: 80, y: 40 },
    { x: 60, y: 40 },
    { x: 40, y: 40 },
    { x: 20, y: 40 },
  ];
  direction = 'Right';
  nextDirection = 'Right';
  score = 0;
  paused = false;
  gameOver = false;
  fruit = new Fruit();
  updateScore();
  drawScene();
  timer = setInterval(tick, 115);
}

function updateScore() {
  scoreElement.textContent = `遊戲分數：${score}`;
  highestScoreElement.textContent = `最高分數：${highestScore}`;
}

function drawBoard() {
  const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, '#14241a');
  background.addColorStop(1, '#09120d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(145,190,151,.055)';
  ctx.lineWidth = 1;
  for (let i = unit; i < canvas.width; i += unit) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
  }
  for (let i = unit; i < canvas.height; i += unit) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
  }
}

function drawSnake() {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#53ad68';
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;

  for (let i = snake.length - 1; i > 0; i--) {
    const current = snake[i];
    const next = snake[i - 1];
    if (Math.abs(current.x - next.x) <= unit && Math.abs(current.y - next.y) <= unit) {
      ctx.beginPath();
      ctx.moveTo(current.x + unit / 2, current.y + unit / 2);
      ctx.lineTo(next.x + unit / 2, next.y + unit / 2);
      ctx.stroke();
    }
  }

  snake.slice(1).forEach((segment, index) => {
    const radius = Math.max(5, 7 - index * .035);
    const cx = segment.x + unit / 2;
    const cy = segment.y + unit / 2;
    const body = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, radius + 2);
    body.addColorStop(0, '#91dd83');
    body.addColorStop(.65, '#53ad68');
    body.addColorStop(1, '#2f7348');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  drawHead();
  ctx.restore();
}

function drawHead() {
  const head = snake[0];
  const cx = head.x + unit / 2;
  const cy = head.y + unit / 2;
  const forward = directions[direction];
  const side = { x: -forward.y, y: forward.x };

  ctx.fillStyle = '#78cf70';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 9.2, 8.2, direction === 'Up' || direction === 'Down' ? Math.PI / 2 : 0, 0, Math.PI * 2);
  ctx.fill();

  [-1, 1].forEach(sign => {
    const eyeX = cx + forward.x * 4 + side.x * sign * 4;
    const eyeY = cy + forward.y * 4 + side.y * sign * 4;
    ctx.fillStyle = '#f7fff2';
    ctx.beginPath(); ctx.arc(eyeX, eyeY, 2.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#152318';
    ctx.beginPath(); ctx.arc(eyeX + forward.x, eyeY + forward.y, 1.25, 0, Math.PI * 2); ctx.fill();
  });

  const tongueStartX = cx + forward.x * 8;
  const tongueStartY = cy + forward.y * 8;
  ctx.strokeStyle = '#ff6d8c';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.moveTo(tongueStartX, tongueStartY);
  ctx.lineTo(cx + forward.x * 13, cy + forward.y * 13);
  ctx.stroke();
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = 'rgba(4,10,6,.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px "Microsoft JhengHei", sans-serif';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 6);
  ctx.fillStyle = '#c5d6c8';
  ctx.font = '15px "Microsoft JhengHei", sans-serif';
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 24);
}

function drawScene() {
  drawBoard();
  fruit.draw();
  drawSnake();
  if (paused) drawOverlay('遊戲暫停', '按空白鍵繼續');
  if (gameOver) drawOverlay('遊戲結束', `本次得分：${score}`);
}

function tick() {
  if (paused || gameOver) return;
  direction = nextDirection;
  const vector = directions[direction];
  const head = snake[0];
  const newHead = {
    x: (head.x + vector.x * unit + canvas.width) % canvas.width,
    y: (head.y + vector.y * unit + canvas.height) % canvas.height,
  };

  const ateFruit = newHead.x === fruit.x && newHead.y === fruit.y;
  const bodyToCheck = ateFruit ? snake : snake.slice(0, -1);
  if (bodyToCheck.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
    gameOver = true;
    clearInterval(timer);
    drawScene();
    return;
  }

  snake.unshift(newHead);
  if (ateFruit) {
    score += 1;
    if (score > highestScore) {
      highestScore = score;
      localStorage.setItem('highestScore', String(highestScore));
    }
    fruit.pickLocation();
    updateScore();
  } else {
    snake.pop();
  }
  drawScene();
}

function changeDirection(event) {
  const keyMap = {
    ArrowRight: 'Right', d: 'Right', D: 'Right',
    ArrowDown: 'Down', s: 'Down', S: 'Down',
    ArrowLeft: 'Left', a: 'Left', A: 'Left',
    ArrowUp: 'Up', w: 'Up', W: 'Up',
  };
  if (event.code === 'Space') {
    event.preventDefault();
    if (!gameOver) {
      paused = !paused;
      drawScene();
    }
    return;
  }
  const requested = keyMap[event.key];
  if (!requested) return;
  event.preventDefault();
  const current = directions[direction];
  const candidate = directions[requested];
  if (current.x + candidate.x !== 0 || current.y + candidate.y !== 0) {
    nextDirection = requested;
  }
}

window.addEventListener('keydown', changeDirection);
restartButton.addEventListener('click', startGame);
startGame();
