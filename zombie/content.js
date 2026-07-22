const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const healthFill = document.querySelector('#health-fill');
const healthValue = document.querySelector('#health-value');
const scoreElement = document.querySelector('#score');
const timeElement = document.querySelector('#time');
const overlay = document.querySelector('#overlay');
const dialogIcon = document.querySelector('#dialog-icon');
const dialogTitle = document.querySelector('#dialog-title');
const introView = document.querySelector('#intro-view');
const nameForm = document.querySelector('#name-form');
const playerNameInput = document.querySelector('#player-name');
const finalScoreElement = document.querySelector('#final-score');
const rankingView = document.querySelector('#ranking-view');
const rankingSummary = document.querySelector('#ranking-summary');
const rankingList = document.querySelector('#ranking');
const startButton = document.querySelector('#start');
const restartButton = document.querySelector('#restart');
const playAgainButton = document.querySelector('#play-again');

const width = canvas.width;
const height = canvas.height;
const player = { x: width / 2, y: height / 2, radius: 17, speed: 300, health: 100, angle: 0, invincibleUntil: 0 };
const zombies = [];
const medkits = [];
const mutants = [];
const spitProjectiles = [];
const acidPuddles = [];
const particles = [];
const pressedKeys = new Set();
const rankingKey = 'zombieSurvivorRanking';

let running = false;
let paused = false;
let elapsed = 0;
let bonusScore = 0;
let lastTime = performance.now();
let zombieSpawnTimer = 0;
let medkitSpawnTimer = 0;
let mutantSpawnTimer = 0;
let mutantSpawnCount = 0;
let screenFlash = 0;
let animationId;

function startGame() {
  pressedKeys.clear();
  player.x = width / 2;
  player.y = height / 2;
  player.health = 100;
  player.invincibleUntil = 0;
  zombies.length = 0;
  medkits.length = 0;
  mutants.length = 0;
  spitProjectiles.length = 0;
  acidPuddles.length = 0;
  particles.length = 0;
  elapsed = 0;
  bonusScore = 0;
  zombieSpawnTimer = .4;
  medkitSpawnTimer = 12;
  mutantSpawnTimer = 10;
  mutantSpawnCount = 0;
  screenFlash = 0;
  paused = false;
  running = true;
  overlay.hidden = true;
  updateHud();
  lastTime = performance.now();
}

function createEdgeMover(radius, minimumSpeed, maximumSpeed) {
  const edge = Math.floor(Math.random() * 4);
  const positions = [
    { x: Math.random() * width, y: -radius - 2, angle: Math.PI / 2 },
    { x: width + radius + 2, y: Math.random() * height, angle: Math.PI },
    { x: Math.random() * width, y: height + radius + 2, angle: -Math.PI / 2 },
    { x: -radius - 2, y: Math.random() * height, angle: 0 },
  ];
  const curved = Math.random() < .5;
  return {
    ...positions[edge],
    radius,
    speed: minimumSpeed + Math.random() * (maximumSpeed - minimumSpeed),
    angle: positions[edge].angle + (Math.random() - .5) * .75,
    curve: curved ? (Math.random() < .5 ? -1 : 1) * (.16 + Math.random() * .28) : 0,
    path: curved ? 'curve' : 'straight',
    age: 0,
  };
}

function spawnZombie() {
  if (zombies.length >= 100) return;
  const speedBoost = Math.min(elapsed * .9, 80);
  const size = 17 + Math.random() * 8;
  zombies.push({ ...createEdgeMover(size, 125 + speedBoost, 235 + speedBoost), wobble: Math.random() * Math.PI * 2, hue: 82 + Math.random() * 35 });
}

function spawnMedkit() {
  const fast = Math.random() < .5;
  medkits.push({ ...createEdgeMover(15, fast ? 130 : 68, fast ? 180 : 98), rotation: 0 });
}

function spawnMutant() {
  const inset = 48;
  const corners = [
    { x: inset, y: inset },
    { x: width - inset, y: inset },
    { x: width - inset, y: height - inset },
    { x: inset, y: height - inset },
  ];
  const corner = corners[mutantSpawnCount % corners.length];
  const hue = [8, 42, 118, 188, 225, 278, 326][mutantSpawnCount % 7];
  mutantSpawnCount += 1;
  mutants.push({
    ...corner, radius: 37, life: 30, spitTimer: 5, pulse: Math.random() * Math.PI * 2,
    color: `hsl(${hue} 72% 48%)`, lightColor: `hsl(${hue} 90% 70%)`,
    darkColor: `hsl(${hue} 68% 24%)`, glowColor: `hsl(${hue} 100% 62%)`,
  });
}

function launchSpit(mutant) {
  spitProjectiles.push({
    startX: mutant.x,
    startY: mutant.y,
    x: mutant.x,
    y: mutant.y,
    targetX: 55 + Math.random() * (width - 110),
    targetY: 55 + Math.random() * (height - 110),
    progress: 0,
    duration: .85 + Math.random() * .35,
    color: mutant.color,
    lightColor: mutant.lightColor,
    darkColor: mutant.darkColor,
    glowColor: mutant.glowColor,
  });
}

function createAcidPuddle(x, y, spit) {
  acidPuddles.push({
    x, y, radius: 87, life: 5, maxLife: 5, damageTimer: 0, totalDamage: 0,
    phase: Math.random() * Math.PI * 2,
    color: spit.color, lightColor: spit.lightColor, darkColor: spit.darkColor,
  });
}

function moveOnPath(entity, delta) {
  entity.angle += entity.curve * delta;
  entity.x += Math.cos(entity.angle) * entity.speed * delta;
  entity.y += Math.sin(entity.angle) * entity.speed * delta;
  entity.age += delta;
}

function leftPlayArea(entity) {
  if (entity.age < .35) return false;
  const margin = entity.radius + 45;
  return entity.x < -margin || entity.x > width + margin || entity.y < -margin || entity.y > height + margin || entity.age > 14;
}

function update(delta, now) {
  elapsed += delta;
  zombieSpawnTimer -= delta;
  medkitSpawnTimer -= delta;
  mutantSpawnTimer -= delta;
  screenFlash = Math.max(0, screenFlash - delta * 2.5);

  let moveX = Number(pressedKeys.has('ArrowRight')) - Number(pressedKeys.has('ArrowLeft'));
  let moveY = Number(pressedKeys.has('ArrowDown')) - Number(pressedKeys.has('ArrowUp'));
  if (moveX !== 0 || moveY !== 0) {
    const length = Math.hypot(moveX, moveY);
    moveX /= length;
    moveY /= length;
    player.x += moveX * player.speed * delta;
    player.y += moveY * player.speed * delta;
    player.angle = Math.atan2(moveY, moveX);
  }
  player.x = Math.max(player.radius, Math.min(width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(height - player.radius, player.y));

  if (zombieSpawnTimer <= 0) {
    const waveSize = 2 ** Math.floor(elapsed / 20);
    const availableSlots = Math.max(0, 100 - zombies.length);
    const spawnCount = Math.min(waveSize, availableSlots);
    for (let count = 0; count < spawnCount; count += 1) spawnZombie();
    const interval = Math.max(.17, .59 - elapsed * .004);
    zombieSpawnTimer = interval * (.78 + Math.random() * .45);
  }
  if (medkitSpawnTimer <= 0) {
    spawnMedkit();
    medkitSpawnTimer = 12;
  }
  if (mutantSpawnTimer <= 0) {
    spawnMutant();
    mutantSpawnTimer += 10;
  }

  for (let index = mutants.length - 1; index >= 0; index -= 1) {
    const mutant = mutants[index];
    mutant.life -= delta;
    mutant.spitTimer -= delta;
    mutant.pulse += delta * 3;
    if (mutant.spitTimer <= 0) {
      launchSpit(mutant);
      mutant.spitTimer += 5;
    }
    if (mutant.life <= 0) mutants.splice(index, 1);
  }

  for (let index = spitProjectiles.length - 1; index >= 0; index -= 1) {
    const spit = spitProjectiles[index];
    spit.progress += delta / spit.duration;
    const progress = Math.min(1, spit.progress);
    spit.x = spit.startX + (spit.targetX - spit.startX) * progress;
    spit.y = spit.startY + (spit.targetY - spit.startY) * progress;
    if (spit.progress >= 1) {
      createAcidPuddle(spit.targetX, spit.targetY, spit);
      spitProjectiles.splice(index, 1);
    }
  }

  for (let index = acidPuddles.length - 1; index >= 0; index -= 1) {
    const puddle = acidPuddles[index];
    puddle.life -= delta;
    puddle.phase += delta * 4;
    if (Math.hypot(player.x - puddle.x, player.y - puddle.y) <= player.radius + puddle.radius && puddle.totalDamage < 10) {
      puddle.damageTimer += delta;
      while (puddle.damageTimer >= 1 && puddle.totalDamage < 10) {
        puddle.damageTimer -= 1;
        puddle.totalDamage += 2;
        player.health = Math.max(0, player.health - 2);
        screenFlash = Math.max(screenFlash, .13);
        updateHud();
        if (player.health === 0) {
          endGame();
          break;
        }
      }
    }
    if (puddle.life <= 0) acidPuddles.splice(index, 1);
  }
  if (!running) return;

  for (let index = zombies.length - 1; index >= 0; index -= 1) {
    const zombie = zombies[index];
    moveOnPath(zombie, delta);
    zombie.wobble += delta * 7;
    if (touching(zombie, player)) {
      zombies.splice(index, 1);
      if (now >= player.invincibleUntil) damagePlayer(now);
    } else if (leftPlayArea(zombie)) {
      zombies.splice(index, 1);
    }
  }

  for (let index = medkits.length - 1; index >= 0; index -= 1) {
    const medkit = medkits[index];
    moveOnPath(medkit, delta);
    medkit.rotation += delta * 2;
    if (touching(medkit, player)) {
      medkits.splice(index, 1);
      player.health = Math.min(100, player.health + 20);
      bonusScore += 50;
      createParticles(player.x, player.y, '#8ff0a5', 14);
      updateHud();
    } else if (leftPlayArea(medkit)) {
      medkits.splice(index, 1);
    }
  }

  particles.forEach(particle => {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
  });
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    if (particles[index].life <= 0) particles.splice(index, 1);
  }
  updateHud();
}

function touching(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= a.radius + b.radius;
}

function damagePlayer(now) {
  player.health = Math.max(0, player.health - 10);
  player.invincibleUntil = now + 650;
  screenFlash = .48;
  createParticles(player.x, player.y, '#ff6675', 18);
  updateHud();
  if (player.health === 0) endGame();
}

function createParticles(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 115;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 2 + Math.random() * 3, color, life: .4 + Math.random() * .5 });
  }
}

function currentScore() {
  return Math.floor(elapsed * 10) + bonusScore;
}

function updateHud() {
  healthFill.style.width = `${player.health}%`;
  healthFill.style.background = player.health <= 30 ? 'linear-gradient(90deg,#c51f3b,#ff5266)' : 'linear-gradient(90deg,#ff5266,#ff9b72)';
  healthValue.textContent = String(player.health);
  scoreElement.textContent = String(currentScore());
  timeElement.textContent = `${elapsed.toFixed(1)} 秒`;
}

function drawBackground(time) {
  const gradient = ctx.createRadialGradient(player.x, player.y, 30, player.x, player.y, 430);
  gradient.addColorStop(0, '#263c2d');
  gradient.addColorStop(.46, '#17271d');
  gradient.addColorStop(1, '#0a110d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(126,161,134,.075)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y <= height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(8,12,9,.25)';
  for (let index = 0; index < 9; index += 1) {
    const x = (index * 173 + 40) % width;
    const y = (index * 97 + 65) % height;
    ctx.beginPath(); ctx.arc(x, y, 17 + index % 3 * 9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = .08 + Math.sin(time / 900) * .02;
  ctx.fillStyle = '#d4ffe0';
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
}

function drawPlayer(now) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle + Math.PI / 2);
  if (now < player.invincibleUntil && Math.floor(now / 80) % 2 === 0) ctx.globalAlpha = .35;
  ctx.shadowColor = '#70e7ff';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = '#16253a';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(-9, 23); ctx.moveTo(6, 10); ctx.lineTo(9, 23); ctx.stroke();
  ctx.strokeStyle = '#f0c5a4';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(-16, 9); ctx.moveTo(9, -2); ctx.lineTo(16, 9); ctx.stroke();
  const shirt = ctx.createLinearGradient(-12, -8, 12, 13);
  shirt.addColorStop(0, '#6be2ff'); shirt.addColorStop(1, '#276bad');
  ctx.fillStyle = shirt;
  roundedRect(-11, -9, 22, 25, 8); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#f0c5a4'; ctx.beginPath(); ctx.arc(0, -16, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#33251f'; ctx.beginPath(); ctx.arc(0, -19, 7.5, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawZombie(zombie) {
  ctx.save();
  ctx.translate(zombie.x, zombie.y);
  ctx.rotate(zombie.angle + Math.PI / 2);
  const step = Math.sin(zombie.wobble) * 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#47623f'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-6, 9); ctx.lineTo(-10 + step, 22); ctx.moveTo(6, 9); ctx.lineTo(10 - step, 22); ctx.stroke();
  ctx.strokeStyle = `hsl(${zombie.hue},35%,48%)`; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-17, 7 + step); ctx.moveTo(10, -3); ctx.lineTo(17, 7 - step); ctx.stroke();
  ctx.fillStyle = '#553c4c'; roundedRect(-11, -8, 22, 24, 5); ctx.fill();
  ctx.fillStyle = `hsl(${zombie.hue},38%,52%)`; ctx.beginPath(); ctx.arc(0, -15, zombie.radius * .48, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffdc62'; ctx.beginPath(); ctx.arc(-3, -16, 1.5, 0, Math.PI * 2); ctx.arc(3, -16, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3b1d24'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -11); ctx.lineTo(4, -11); ctx.stroke();
  ctx.restore();
}

function drawMedkit(medkit) {
  ctx.save(); ctx.translate(medkit.x, medkit.y); ctx.rotate(Math.sin(medkit.rotation) * .14);
  ctx.shadowColor = '#7dff9c'; ctx.shadowBlur = 15;
  ctx.fillStyle = '#e9fff0'; roundedRect(-14, -12, 28, 24, 6); ctx.fill();
  ctx.fillStyle = '#e74355'; ctx.fillRect(-4, -9, 8, 18); ctx.fillRect(-10, -3, 20, 7);
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#8dc79b'; ctx.lineWidth = 2; roundedRect(-14, -12, 28, 24, 6); ctx.stroke();
  ctx.restore();
}

function drawAcidPuddle(puddle) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, puddle.life) * .68;
  const gradient = ctx.createRadialGradient(puddle.x - 7, puddle.y - 7, 2, puddle.x, puddle.y, puddle.radius);
  gradient.addColorStop(0, puddle.lightColor);
  gradient.addColorStop(.45, puddle.color);
  gradient.addColorStop(1, puddle.darkColor);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(puddle.x, puddle.y, puddle.radius, puddle.radius * .72, Math.sin(puddle.phase) * .08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = puddle.lightColor;
  for (let i = 0; i < 4; i += 1) {
    const angle = puddle.phase + i * 1.7;
    ctx.beginPath();
    ctx.arc(puddle.x + Math.cos(angle) * 14, puddle.y + Math.sin(angle) * 9, 2 + i % 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpit(spit) {
  const heightArc = Math.sin(Math.min(1, spit.progress) * Math.PI) * 38;
  ctx.save();
  ctx.shadowColor = spit.glowColor;
  ctx.shadowBlur = 13;
  ctx.fillStyle = spit.lightColor;
  ctx.beginPath();
  ctx.arc(spit.x, spit.y - heightArc, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMutant(mutant) {
  ctx.save();
  ctx.translate(mutant.x, mutant.y);
  ctx.rotate(Math.atan2(height / 2 - mutant.y, width / 2 - mutant.x) + Math.PI / 2);
  const pulse = 1 + Math.sin(mutant.pulse) * .035;
  ctx.scale(pulse, pulse);

  // 尾巴
  ctx.strokeStyle = '#345f3d';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 19);
  ctx.bezierCurveTo(8, 35, 25, 42, 18, 58);
  ctx.stroke();
  ctx.strokeStyle = '#87c85c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1, 20);
  ctx.bezierCurveTo(8, 34, 22, 42, 18, 55);
  ctx.stroke();

  // 翅膀
  ctx.shadowColor = '#81ff68';
  ctx.shadowBlur = 15;
  [-1, 1].forEach(side => {
    ctx.fillStyle = '#4c8060';
    ctx.beginPath();
    ctx.moveTo(side * 10, -5);
    ctx.quadraticCurveTo(side * 38, -31, side * 48, -9);
    ctx.lineTo(side * 34, -3);
    ctx.lineTo(side * 46, 12);
    ctx.quadraticCurveTo(side * 24, 9, side * 12, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#9dd56e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(197,255,152,.45)';
    ctx.beginPath();
    ctx.moveTo(side * 13, -3);
    ctx.lineTo(side * 38, -18);
    ctx.moveTo(side * 16, 5);
    ctx.lineTo(side * 38, 5);
    ctx.stroke();
  });

  // 身體與腹部
  const body = ctx.createRadialGradient(-8, -10, 2, 0, 4, 34);
  body.addColorStop(0, '#a6d878');
  body.addColorStop(.42, '#4f8b52');
  body.addColorStop(1, '#24462f');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 7, 23, 29, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#b9d779';
  ctx.beginPath();
  ctx.ellipse(0, 9, 11, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(59,96,44,.55)';
  ctx.lineWidth = 1.5;
  for (let y = -6; y <= 22; y += 7) {
    ctx.beginPath(); ctx.moveTo(-8, y); ctx.quadraticCurveTo(0, y + 4, 8, y); ctx.stroke();
  }

  // 腳與爪
  [-1, 1].forEach(side => {
    ctx.strokeStyle = '#315b39';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(side * 14, 18); ctx.lineTo(side * 24, 29); ctx.stroke();
    ctx.strokeStyle = '#e8efbd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(side * 23, 28); ctx.lineTo(side * 29, 32);
    ctx.moveTo(side * 22, 29); ctx.lineTo(side * 24, 35);
    ctx.stroke();
  });

  // 龍頸與頭
  ctx.fillStyle = '#4d8650';
  ctx.beginPath();
  ctx.ellipse(0, -17, 13, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#72aa5e';
  ctx.beginPath();
  ctx.ellipse(0, -33, 19, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // 龍角
  ctx.fillStyle = '#e9edbb';
  ctx.beginPath();
  ctx.moveTo(-11, -42); ctx.lineTo(-17, -58); ctx.lineTo(-4, -44);
  ctx.moveTo(11, -42); ctx.lineTo(17, -58); ctx.lineTo(4, -44);
  ctx.fill();

  // 吻部、眼睛與毒液
  ctx.fillStyle = '#8dc66a';
  ctx.beginPath();
  ctx.ellipse(0, -26, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd95d';
  ctx.beginPath(); ctx.arc(-7, -37, 3.2, 0, Math.PI * 2); ctx.arc(7, -37, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#182619';
  ctx.beginPath(); ctx.ellipse(-7, -37, 1, 2.5, 0, 0, Math.PI * 2); ctx.ellipse(7, -37, 1, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#23351e';
  ctx.beginPath(); ctx.arc(-5, -27, 1.6, 0, Math.PI * 2); ctx.arc(5, -27, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b5f24d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(2, -15, Math.sin(mutant.pulse) * 3, -10);
  ctx.stroke();

  // 背部毒鱗
  ctx.fillStyle = '#adf05a';
  for (let y = -14; y <= 15; y += 8) {
    ctx.beginPath();
    ctx.moveTo(-19, y); ctx.lineTo(-28, y + 4); ctx.lineTo(-19, y + 8);
    ctx.fill();
  }
  ctx.restore();
}

function drawDragonHead(mutant) {
  ctx.save();
  ctx.translate(mutant.x, mutant.y);
  ctx.rotate(Math.atan2(height / 2 - mutant.y, width / 2 - mutant.x) + Math.PI / 2);
  const pulse = 1 + Math.sin(mutant.pulse) * .045;
  ctx.scale(pulse, pulse);
  ctx.shadowColor = mutant.glowColor;
  ctx.shadowBlur = 18;

  ctx.fillStyle = '#f1e1bd';
  ctx.beginPath();
  ctx.moveTo(-18, -22); ctx.lineTo(-30, -48); ctx.lineTo(-7, -27);
  ctx.moveTo(18, -22); ctx.lineTo(30, -48); ctx.lineTo(7, -27);
  ctx.fill();

  [-1, 1].forEach(side => {
    ctx.fillStyle = mutant.lightColor;
    ctx.beginPath();
    ctx.moveTo(side * 24, -8); ctx.lineTo(side * 39, -20); ctx.lineTo(side * 31, 1);
    ctx.moveTo(side * 27, 7); ctx.lineTo(side * 40, 1); ctx.lineTo(side * 29, 17);
    ctx.fill();
  });

  const head = ctx.createLinearGradient(-34, -6, 34, 8);
  head.addColorStop(0, '#e7472e');
  head.addColorStop(.18, '#f5a623');
  head.addColorStop(.36, '#f3dc32');
  head.addColorStop(.52, '#35c26b');
  head.addColorStop(.68, '#2dbbd3');
  head.addColorStop(.84, '#475de0');
  head.addColorStop(1, '#b33ac6');
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.moveTo(0, -37);
  ctx.bezierCurveTo(-31, -39, -39, -18, -31, 6);
  ctx.quadraticCurveTo(-25, 30, 0, 38);
  ctx.quadraticCurveTo(25, 30, 31, 6);
  ctx.bezierCurveTo(39, -18, 31, -39, 0, -37);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = mutant.lightColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 參照彩虹龍圖，在臉部鋪上多色菱形鱗片。
  const scaleColors = ['#ff5940', '#ffad27', '#f2dc38', '#43ca65', '#28bbce', '#4f68e3', '#bd45ce'];
  for (let row = 0; row < 4; row += 1) {
    const y = -27 + row * 10;
    const count = 3 + row;
    for (let column = 0; column < count; column += 1) {
      const x = (column - (count - 1) / 2) * 9;
      ctx.fillStyle = scaleColors[(column + row) % scaleColors.length];
      ctx.beginPath();
      ctx.moveTo(x, y - 5); ctx.lineTo(x - 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x + 4, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,45,.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  ctx.fillStyle = mutant.darkColor;
  for (let y = -28; y <= -7; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y - 7); ctx.lineTo(-7, y); ctx.lineTo(0, y + 5); ctx.lineTo(7, y);
    ctx.closePath(); ctx.fill();
  }

  ctx.strokeStyle = mutant.darkColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-24, -16); ctx.lineTo(-7, -11);
  ctx.moveTo(24, -16); ctx.lineTo(7, -11);
  ctx.stroke();
  ctx.fillStyle = '#fff36b';
  ctx.beginPath();
  ctx.ellipse(-15, -9, 7, 4, -.18, 0, Math.PI * 2);
  ctx.ellipse(15, -9, 7, 4, .18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1220';
  ctx.beginPath();
  ctx.ellipse(-15, -9, 1.5, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(15, -9, 1.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = mutant.lightColor;
  ctx.beginPath(); ctx.ellipse(0, 16, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = mutant.darkColor;
  ctx.beginPath();
  ctx.ellipse(-8, 12, 3, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(8, 12, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#321526';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-13, 23); ctx.quadraticCurveTo(0, 29, 13, 23); ctx.stroke();
  ctx.fillStyle = '#fff2d7';
  ctx.beginPath();
  ctx.moveTo(-12, 23); ctx.lineTo(-7, 34); ctx.lineTo(-3, 26);
  ctx.moveTo(12, 23); ctx.lineTo(7, 34); ctx.lineTo(3, 26);
  ctx.fill();

  ctx.strokeStyle = mutant.glowColor;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 28); ctx.quadraticCurveTo(3, 34, Math.sin(mutant.pulse) * 3, 40);
  ctx.stroke();
  ctx.restore();
}

function roundedRect(x, y, rectWidth, rectHeight, radius) {
  ctx.beginPath(); ctx.roundRect(x, y, rectWidth, rectHeight, radius);
}

function draw(now) {
  drawBackground(now);
  acidPuddles.forEach(drawAcidPuddle);
  medkits.forEach(drawMedkit);
  mutants.forEach(drawDragonHead);
  spitProjectiles.forEach(drawSpit);
  zombies.forEach(drawZombie);
  drawPlayer(now);
  particles.forEach(particle => { ctx.globalAlpha = Math.max(0, particle.life); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1;
  if (paused && running) drawMessage('遊戲暫停', '按空白鍵繼續');
  if (screenFlash > 0) { ctx.fillStyle = `rgba(255,40,65,${screenFlash * .28})`; ctx.fillRect(0, 0, width, height); }
}

function drawMessage(title, message) {
  ctx.fillStyle = 'rgba(3,8,5,.68)'; ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 40px "Microsoft JhengHei",sans-serif'; ctx.fillText(title, width / 2, height / 2 - 8);
  ctx.fillStyle = '#bdd0c0'; ctx.font = '19px "Microsoft JhengHei",sans-serif'; ctx.fillText(message, width / 2, height / 2 + 30);
}

function gameLoop(now) {
  const delta = Math.min((now - lastTime) / 1000, .033);
  lastTime = now;
  if (running && !paused) update(delta, now);
  draw(now);
  animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;
  paused = false;
  overlay.hidden = false;
  introView.hidden = true;
  rankingView.hidden = true;
  nameForm.hidden = false;
  dialogIcon.textContent = '🧟';
  dialogTitle.textContent = '你被殭屍包圍了';
  finalScoreElement.textContent = `本局生存 ${elapsed.toFixed(1)} 秒，得到 ${currentScore()} 分。`;
  playerNameInput.value = '';
  playerNameInput.focus();
}

function loadRanking() {
  try { return JSON.parse(localStorage.getItem(rankingKey)) || []; }
  catch { return []; }
}

function saveScore(name) {
  const entries = loadRanking();
  entries.push({ name: name.slice(0, 12), score: currentScore(), time: Number(elapsed.toFixed(1)), createdAt: Date.now() });
  entries.sort((a, b) => b.score - a.score || b.time - a.time || a.createdAt - b.createdAt);
  const topTen = entries.slice(0, 10);
  localStorage.setItem(rankingKey, JSON.stringify(topTen));
  return topTen;
}

function showRanking(entries, playerName) {
  nameForm.hidden = true;
  rankingView.hidden = false;
  dialogIcon.textContent = '🏆';
  dialogTitle.textContent = '生存者排行榜';
  rankingSummary.textContent = `${playerName} 的成績已登記。排行榜保存在這台裝置。`;
  rankingList.replaceChildren();
  if (!entries.length) { const empty = document.createElement('li'); empty.className = 'empty'; empty.textContent = '目前還沒有成績'; rankingList.append(empty); return; }
  entries.forEach((entry, index) => {
    const item = document.createElement('li');
    const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = `#${index + 1}`;
    const name = document.createElement('span'); name.textContent = entry.name;
    const points = document.createElement('span'); points.className = 'points'; points.textContent = `${entry.score} 分`;
    item.append(rank, name, points); rankingList.append(item);
  });
}

window.addEventListener('keydown', event => {
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    pressedKeys.add(event.key);
  }
  if (event.code === 'Space' && running) {
    event.preventDefault();
    paused = !paused;
  }
});
window.addEventListener('keyup', event => pressedKeys.delete(event.key));
window.addEventListener('blur', () => pressedKeys.clear());
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
playAgainButton.addEventListener('click', startGame);
nameForm.addEventListener('submit', event => { event.preventDefault(); const name = playerNameInput.value.trim(); if (!name) return; showRanking(saveScore(name), name); });

updateHud();
animationId = requestAnimationFrame(gameLoop);
