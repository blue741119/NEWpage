const canvas = document.querySelector('#myCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.querySelector('#score');
const remainingElement = document.querySelector('#remaining');
const restartButton = document.querySelector('#restart');

const width = canvas.width;
const height = canvas.height;
const ball = { x: width / 2, y: 430, radius: 15, vx: 285, vy: -310 };
const paddle = { x: width / 2 - 78, y: 548, width: 156, height: 16 };
const trail = [];
const stars = Array.from({ length: 70 }, (_, index) => ({
  x: (index * 137.5) % width,
  y: (index * 83.7) % height,
  radius: .5 + (index % 3) * .45,
  alpha: .16 + (index % 5) * .08,
}));

let bricks = [];
let score = 0;
let paused = false;
let finished = false;
let endReason = '';
let lastTime = performance.now();
let animationId;

class Brick {
  constructor(x, y, row, column) {
    this.x = x;
    this.y = y;
    this.width = 122;
    this.height = 38;
    this.row = row;
    this.column = column;
    this.visible = true;
    this.hue = [190, 225, 265][row % 3];
  }

  draw() {
    if (!this.visible) return;
    ctx.save();
    ctx.shadowColor = `hsla(${this.hue},95%,68%,.8)`;
    ctx.shadowBlur = 13;
    const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
    gradient.addColorStop(0, `hsl(${this.hue},92%,72%)`);
    gradient.addColorStop(.5, `hsl(${this.hue},82%,57%)`);
    gradient.addColorStop(1, `hsl(${this.hue},74%,38%)`);
    roundedRect(this.x, this.y, this.width, this.height, 11);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,.28)';
    roundedRect(this.x + 8, this.y + 6, this.width - 16, 5, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + this.height / 2 + 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function roundedRect(x, y, rectWidth, rectHeight, radius) {
  const r = Math.min(radius, rectWidth / 2, rectHeight / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + rectWidth, y, x + rectWidth, y + rectHeight, r);
  ctx.arcTo(x + rectWidth, y + rectHeight, x, y + rectHeight, r);
  ctx.arcTo(x, y + rectHeight, x, y, r);
  ctx.arcTo(x, y, x + rectWidth, y, r);
  ctx.closePath();
}

function createBricks() {
  bricks = [];
  const columns = 6;
  const gap = 18;
  const totalWidth = columns * 122 + (columns - 1) * gap;
  const startX = (width - totalWidth) / 2;
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const offset = row === 1 ? 10 : 0;
      bricks.push(new Brick(startX + column * 140 + offset, 80 + row * 58, row, column));
    }
  }
}

function resetGame() {
  cancelAnimationFrame(animationId);
  ball.x = width / 2;
  ball.y = 430;
  ball.vx = 285;
  ball.vy = -310;
  paddle.x = width / 2 - paddle.width / 2;
  score = 0;
  paused = false;
  finished = false;
  endReason = '';
  trail.length = 0;
  createBricks();
  updateHud();
  lastTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

function updateHud() {
  const remaining = bricks.filter(brick => brick.visible).length;
  scoreElement.textContent = `分數：${score}`;
  remainingElement.textContent = `剩餘目標：${remaining}`;
}

function update(delta) {
  const previousX = ball.x;
  const previousY = ball.y;
  ball.x += ball.vx * delta;
  ball.y += ball.vy * delta;

  if (ball.x + ball.radius >= width) {
    ball.x = width - ball.radius;
    ball.vx = -Math.abs(ball.vx);
  } else if (ball.x - ball.radius <= 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx);
  }
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy);
  } else if (ball.y + ball.radius >= height) {
    ball.y = height - ball.radius;
    score = Math.floor(score / 2);
    updateHud();
    if (score === 0) {
      finished = true;
      endReason = 'loss';
      return;
    }
    ball.vy = -Math.abs(ball.vy);
  }

  const hitsPaddle =
    ball.vy > 0 &&
    ball.x + ball.radius >= paddle.x &&
    ball.x - ball.radius <= paddle.x + paddle.width &&
    ball.y + ball.radius >= paddle.y &&
    ball.y - ball.radius <= paddle.y + paddle.height;

  if (hitsPaddle) {
    ball.y = paddle.y - ball.radius;
    const relativeHit = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    const speed = Math.hypot(ball.vx, ball.vy);
    const angle = relativeHit * Math.PI * .34;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
  }

  for (const brick of bricks) {
    if (!brick.visible || !circleTouchesRect(ball, brick)) continue;
    brick.visible = false;
    score += 100;
    const cameFromSide =
      previousX + ball.radius <= brick.x ||
      previousX - ball.radius >= brick.x + brick.width;
    if (cameFromSide) ball.vx *= -1;
    else ball.vy *= -1;
    updateHud();
    if (bricks.every(item => !item.visible)) {
      finished = true;
      endReason = 'win';
    }
    break;
  }

  trail.unshift({ x: ball.x, y: ball.y });
  if (trail.length > 13) trail.pop();
}

function circleTouchesRect(circle, rect) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function drawBackground(time) {
  const background = ctx.createRadialGradient(width / 2, height / 2, 30, width / 2, height / 2, width * .7);
  background.addColorStop(0, '#172451');
  background.addColorStop(.62, '#0d1430');
  background.addColorStop(1, '#060916');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  stars.forEach((star, index) => {
    ctx.globalAlpha = star.alpha + Math.sin(time / 700 + index) * .08;
    ctx.fillStyle = '#cbe9ff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(109,144,255,.055)';
  ctx.lineWidth = 1;
  for (let y = 20; y < height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
}

function drawBall() {
  trail.forEach((point, index) => {
    const progress = 1 - index / trail.length;
    ctx.globalAlpha = progress * .2;
    ctx.fillStyle = '#69eaff';
    ctx.beginPath();
    ctx.arc(point.x, point.y, ball.radius * progress, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.shadowColor = '#5deaff';
  ctx.shadowBlur = 22;
  const gradient = ctx.createRadialGradient(ball.x - 6, ball.y - 7, 2, ball.x, ball.y, ball.radius);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(.22, '#baf7ff');
  gradient.addColorStop(.58, '#55dff5');
  gradient.addColorStop(1, '#4872de');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawPaddle() {
  ctx.save();
  ctx.shadowColor = '#856dff';
  ctx.shadowBlur = 18;
  const gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.width, paddle.y);
  gradient.addColorStop(0, '#506fd9');
  gradient.addColorStop(.5, '#b7f7ff');
  gradient.addColorStop(1, '#8f6ff1');
  roundedRect(paddle.x, paddle.y, paddle.width, paddle.height, 8);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  roundedRect(paddle.x + 18, paddle.y + 3, paddle.width - 36, 3, 2);
  ctx.fill();
  ctx.restore();
}

function drawOverlay(title, message) {
  ctx.fillStyle = 'rgba(3,6,18,.72)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 42px "Microsoft JhengHei", sans-serif';
  ctx.fillText(title, width / 2, height / 2 - 8);
  ctx.fillStyle = '#c3cceb';
  ctx.font = '20px "Microsoft JhengHei", sans-serif';
  ctx.fillText(message, width / 2, height / 2 + 34);
}

function draw(time) {
  drawBackground(time);
  bricks.forEach(brick => brick.draw());
  drawPaddle();
  drawBall();
  if (paused) drawOverlay('遊戲暫停', '按空白鍵繼續');
  if (finished && endReason === 'win') {
    drawOverlay('挑戰完成！', `最終分數：${score}`);
  }
  if (finished && endReason === 'loss') {
    drawOverlay('遊戲結束', '分數已歸零，請按「重新開始」開新局');
  }
}

function gameLoop(time) {
  const delta = Math.min((time - lastTime) / 1000, .032);
  lastTime = time;
  if (!paused && !finished) update(delta);
  draw(time);
  animationId = requestAnimationFrame(gameLoop);
}

function movePaddle(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scaledX = (clientX - rect.left) * (canvas.width / rect.width);
  paddle.x = Math.max(0, Math.min(width - paddle.width, scaledX - paddle.width / 2));
}

canvas.addEventListener('pointermove', event => movePaddle(event.clientX));
canvas.addEventListener('pointerdown', event => {
  canvas.setPointerCapture(event.pointerId);
  movePaddle(event.clientX);
});
window.addEventListener('keydown', event => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (!finished) paused = !paused;
  }
});
restartButton.addEventListener('click', resetGame);

resetGame();
