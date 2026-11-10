// Chrome Dino Game clone in HTML5 Canvas & Vanilla JS

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const restartBtn = document.getElementById('restart-btn');
const soundBtn = document.getElementById('sound-btn');
const finalScoreEl = document.getElementById('final-score');
const finalHighScoreEl = document.getElementById('final-high-score');
const touchJumpBtn = document.getElementById('touch-jump');
const touchDuckBtn = document.getElementById('touch-duck');

// Canvas dimensions
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 300;
const GROUND_Y = 245;

// Game State
let gameState = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
let score = 0;
let highScore = parseInt(localStorage.getItem('dino_high_score') || '0', 10);
let gameSpeed = 6.5;
const INITIAL_SPEED = 6.5;
const MAX_SPEED = 14;
const ACCELERATION = 0.0015;
let animationFrameId = null;
let lastMilestone = 0;
let isNight = false;

// Sound toggle
soundBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const enabled = soundManager.toggle();
  soundBtn.textContent = enabled ? '🔊' : '🔇';
});

// Dino Object
const dino = {
  x: 50,
  y: GROUND_Y - 48,
  width: 44,
  height: 48,
  standingHeight: 48,
  duckingHeight: 28,
  standingWidth: 44,
  duckingWidth: 58,
  vy: 0,
  gravity: 0.65,
  jumpStrength: -11.8,
  isGrounded: true,
  isDucking: false,
  legTimer: 0,
  legFrame: 0,

  jump() {
    if (this.isGrounded && !this.isDucking) {
      this.vy = this.jumpStrength;
      this.isGrounded = false;
      soundManager.playJump();
    }
  },

  duck(state) {
    if (this.isGrounded) {
      this.isDucking = state;
      if (state) {
        this.height = this.duckingHeight;
        this.width = this.duckingWidth;
        this.y = GROUND_Y - this.duckingHeight;
      } else {
        this.height = this.standingHeight;
        this.width = this.standingWidth;
        this.y = GROUND_Y - this.standingHeight;
      }
    }
  },

  update() {
    // Jump physics
    if (!this.isGrounded) {
      this.vy += this.gravity;
      this.y += this.vy;

      if (this.y >= GROUND_Y - this.height) {
        this.y = GROUND_Y - this.height;
        this.vy = 0;
        this.isGrounded = true;
      }
    }

    // Running leg animation
    if (this.isGrounded) {
      this.legTimer++;
      if (this.legTimer > 6) {
        this.legFrame = 1 - this.legFrame;
        this.legTimer = 0;
      }
    }
  },

  draw(context, color) {
    context.fillStyle = color;
    const px = this.x;
    const py = this.y;

    if (this.isDucking) {
      // Ducking Dino Pixel Art Representation
      // Body (lowered and elongated)
      context.fillRect(px, py + 8, 48, 16);
      context.fillRect(px + 40, py, 18, 14); // snout/head extended
      context.fillRect(px + 48, py + 3, 3, 3); // eye (clear via erase below)
      
      // Eye cutout
      context.fillStyle = isNight ? '#25252c' : '#ffffff';
      context.fillRect(px + 48, py + 3, 3, 3);
      context.fillStyle = color;

      // Tail
      context.fillRect(px - 6, py + 8, 6, 8);

      // Running legs while ducking
      if (this.legFrame === 0) {
        context.fillRect(px + 12, py + 24, 6, 4);
        context.fillRect(px + 28, py + 24, 6, 2);
      } else {
        context.fillRect(px + 12, py + 24, 6, 2);
        context.fillRect(px + 28, py + 24, 6, 4);
      }
    } else {
      // Normal / Jumping Dino Pixel Art Representation
      // Head & Snout
      context.fillRect(px + 22, py, 20, 18);
      context.fillRect(px + 30, py + 18, 12, 4); // mouth/snout underside

      // Eye cutout
      context.fillStyle = isNight ? '#25252c' : '#ffffff';
      context.fillRect(px + 26, py + 4, 4, 4);
      context.fillStyle = color;

      // Neck & Chest
      context.fillRect(px + 18, py + 14, 12, 16);

      // Short Arms
      context.fillRect(px + 32, py + 22, 6, 4);
      context.fillRect(px + 36, py + 24, 2, 4);

      // Main Torso
      context.fillRect(px + 8, py + 20, 18, 18);

      // Tail
      context.fillRect(px + 2, py + 22, 6, 12);
      context.fillRect(px - 4, py + 24, 6, 8);
      context.fillRect(px - 8, py + 26, 4, 4);

      // Legs
      if (!this.isGrounded) {
        // Airborne pose
        context.fillRect(px + 10, py + 38, 5, 6);
        context.fillRect(px + 20, py + 38, 5, 8);
        context.fillRect(px + 23, py + 44, 4, 2);
      } else {
        // Alternating stride
        if (this.legFrame === 0) {
          context.fillRect(px + 10, py + 38, 5, 10);
          context.fillRect(px + 10, py + 46, 7, 2);
          context.fillRect(px + 22, py + 38, 5, 5);
        } else {
          context.fillRect(px + 10, py + 38, 5, 5);
          context.fillRect(px + 22, py + 38, 5, 10);
          context.fillRect(px + 22, py + 46, 7, 2);
        }
      }
    }
  },

  getCollisionBox() {
    // Generates a forgiving bounding box for fair collision detection
    return {
      x: this.x + 4,
      y: this.y + 4,
      width: this.width - 8,
      height: this.height - 6
    };
  }
};

// Ground track dots & texture
const groundSegments = [];
for (let i = 0; i < 60; i++) {
  groundSegments.push({
    x: Math.random() * CANVAS_WIDTH,
    y: GROUND_Y + Math.random() * 40 + 2,
    size: Math.random() < 0.3 ? 2 : 1
  });
}

// Background clouds
const clouds = [
  { x: 200, y: 50, speed: 0.5 },
  { x: 550, y: 80, speed: 0.4 },
  { x: 800, y: 35, speed: 0.6 }
];

// Obstacles manager
let obstacles = [];
let obstacleTimer = 0;
let minSpawnInterval = 65;

class Cactus {
  constructor(x, type) {
    this.x = x;
    this.type = type; // 'small', 'double', 'large'
    this.y = GROUND_Y;
    
    if (type === 'small') {
      this.width = 16;
      this.height = 36;
    } else if (type === 'double') {
      this.width = 34;
      this.height = 36;
    } else {
      this.width = 24;
      this.height = 48;
    }
    this.y = GROUND_Y - this.height;
  }

  draw(context, color) {
    context.fillStyle = color;
    const px = this.x;
    const py = this.y;

    if (this.type === 'small') {
      // Main stem
      context.fillRect(px + 5, py, 6, 36);
      // Left arm
      context.fillRect(px, py + 10, 5, 4);
      context.fillRect(px, py + 6, 4, 8);
      // Right arm
      context.fillRect(px + 11, py + 14, 5, 4);
      context.fillRect(px + 12, py + 10, 4, 8);
    } else if (this.type === 'double') {
      // First cactus
      context.fillRect(px + 4, py + 4, 6, 32);
      context.fillRect(px, py + 12, 4, 4);
      context.fillRect(px, py + 8, 4, 8);
      context.fillRect(px + 10, py + 16, 4, 4);

      // Second taller cactus
      context.fillRect(px + 20, py, 6, 36);
      context.fillRect(px + 16, py + 12, 4, 4);
      context.fillRect(px + 26, py + 14, 4, 4);
      context.fillRect(px + 26, py + 10, 4, 8);
    } else {
      // Large cactus
      context.fillRect(px + 8, py, 8, 48);
      context.fillRect(px, py + 14, 8, 5);
      context.fillRect(px, py + 8, 6, 12);
      context.fillRect(px + 16, py + 20, 8, 5);
      context.fillRect(px + 18, py + 12, 6, 14);
    }
  }

  getCollisionBox() {
    return {
      x: this.x + 2,
      y: this.y + 2,
      width: this.width - 4,
      height: this.height - 4
    };
  }
}

class Pterodactyl {
  constructor(x, heightType) {
    this.x = x;
    this.width = 44;
    this.height = 30;
    // High (jump or duck under), mid (jump or duck), low (must jump)
    if (heightType === 'high') {
      this.y = GROUND_Y - 78;
    } else if (heightType === 'mid') {
      this.y = GROUND_Y - 50;
    } else {
      this.y = GROUND_Y - 32;
    }
    this.wingFrame = 0;
    this.wingTimer = 0;
  }

  update() {
    this.wingTimer++;
    if (this.wingTimer > 10) {
      this.wingFrame = 1 - this.wingFrame;
      this.wingTimer = 0;
    }
  }

  draw(context, color) {
    context.fillStyle = color;
    const px = this.x;
    const py = this.y;

    // Head and beak
    context.fillRect(px, py + 10, 14, 6);
    context.fillRect(px - 4, py + 12, 4, 3); // tip of beak
    // Body
    context.fillRect(px + 14, py + 8, 18, 8);
    // Tail
    context.fillRect(px + 32, py + 9, 8, 4);

    // Flapping Wings
    if (this.wingFrame === 0) {
      // Wing up
      context.fillRect(px + 16, py, 6, 8);
      context.fillRect(px + 20, py - 6, 6, 8);
    } else {
      // Wing down
      context.fillRect(px + 16, py + 16, 6, 8);
      context.fillRect(px + 20, py + 22, 6, 6);
    }
  }

  getCollisionBox() {
    return {
      x: this.x + 3,
      y: this.y + 4,
      width: this.width - 6,
      height: this.height - 8
    };
  }
}

function spawnObstacle() {
  const allowBirds = score > 180;
  const isBird = allowBirds && Math.random() < 0.35;

  if (isBird) {
    const heightTypes = ['low', 'mid', 'high'];
    const selected = heightTypes[Math.floor(Math.random() * heightTypes.length)];
    obstacles.push(new Pterodactyl(CANVAS_WIDTH + 20, selected));
  } else {
    const cactusTypes = ['small', 'double', 'large'];
    const selected = cactusTypes[Math.floor(Math.random() * cactusTypes.length)];
    obstacles.push(new Cactus(CANVAS_WIDTH + 20, selected));
  }
}

// Collision detection (AABB)
function checkCollision(box1, box2) {
  return (
    box1.x < box2.x + box2.width &&
    box1.x + box1.width > box2.x &&
    box1.y < box2.y + box2.height &&
    box1.y + box1.height > box2.y
  );
}

// Reset Game
function resetGame() {
  score = 0;
  gameSpeed = INITIAL_SPEED;
  lastMilestone = 0;
  obstacles = [];
  obstacleTimer = 0;
  dino.y = GROUND_Y - dino.standingHeight;
  dino.vy = 0;
  dino.isGrounded = true;
  dino.duck(false);
  setNightMode(false);
}

function setNightMode(night) {
  isNight = night;
  if (night) {
    document.body.classList.add('night-mode');
  } else {
    document.body.classList.remove('night-mode');
  }
}

function startGame() {
  soundManager.init();
  resetGame();
  gameState = 'PLAYING';
  startScreen.classList.remove('active');
  startScreen.classList.add('hidden');
  gameOverScreen.classList.remove('active');
  gameOverScreen.classList.add('hidden');
}

function gameOver() {
  gameState = 'GAMEOVER';
  soundManager.playDie();

  if (score > highScore) {
    highScore = Math.floor(score);
    localStorage.setItem('dino_high_score', highScore);
  }

  finalScoreEl.textContent = String(Math.floor(score)).padStart(5, '0');
  finalHighScoreEl.textContent = String(highScore).padStart(5, '0');

  gameOverScreen.classList.remove('hidden');
  gameOverScreen.classList.add('active');
}

// Update game loop
function update() {
  if (gameState !== 'PLAYING') return;

  // Increment score
  score += 0.15;

  // Speed scaling
  if (gameSpeed < MAX_SPEED) {
    gameSpeed += ACCELERATION;
  }

  // Milestone beep every 100 points
  const currentHundred = Math.floor(score / 100);
  if (currentHundred > lastMilestone && currentHundred > 0) {
    lastMilestone = currentHundred;
    soundManager.playMilestone();
    
    // Day / Night cycle every 300 points
    if (currentHundred % 3 === 0) {
      setNightMode(!isNight);
    }
  }

  // Update Dino
  dino.update();

  // Clouds movement
  clouds.forEach(cloud => {
    cloud.x -= cloud.speed;
    if (cloud.x + 60 < 0) {
      cloud.x = CANVAS_WIDTH + Math.random() * 50;
      cloud.y = 30 + Math.random() * 60;
    }
  });

  // Ground dots movement
  groundSegments.forEach(dot => {
    dot.x -= gameSpeed;
    if (dot.x < 0) {
      dot.x = CANVAS_WIDTH + Math.random() * 20;
      dot.y = GROUND_Y + Math.random() * 40 + 2;
    }
  });

  // Spawn obstacles
  obstacleTimer++;
  const dynamicInterval = Math.max(38, Math.floor(minSpawnInterval - (gameSpeed - INITIAL_SPEED) * 2));
  if (obstacleTimer > dynamicInterval + Math.random() * 40) {
    spawnObstacle();
    obstacleTimer = 0;
  }

  // Update & Check Obstacles
  const dinoBox = dino.getCollisionBox();
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= gameSpeed;
    if (obs instanceof Pterodactyl) {
      obs.update();
    }

    // Check collision
    if (checkCollision(dinoBox, obs.getCollisionBox())) {
      gameOver();
      return;
    }

    // Remove offscreen
    if (obs.x + obs.width < 0) {
      obstacles.splice(i, 1);
    }
  }
}

// Draw game frame
function draw() {
  const fgColor = isNight ? '#e0e0e0' : '#535353';
  const trackColor = isNight ? '#555566' : '#d2d2d2';

  // Clear Canvas
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 1. Draw Clouds
  ctx.fillStyle = trackColor;
  clouds.forEach(cloud => {
    ctx.fillRect(cloud.x, cloud.y, 40, 10);
    ctx.fillRect(cloud.x + 10, cloud.y - 6, 20, 6);
  });

  // 2. Draw Ground Baseline & Texture
  ctx.fillStyle = fgColor;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 2);

  ctx.fillStyle = trackColor;
  groundSegments.forEach(dot => {
    ctx.fillRect(dot.x, dot.y, dot.size, dot.size);
  });

  // 3. Draw Obstacles
  obstacles.forEach(obs => {
    obs.draw(ctx, fgColor);
  });

  // 4. Draw Dino
  dino.draw(ctx, fgColor);

  // 5. Draw HUD Scores
  ctx.fillStyle = fgColor;
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.textAlign = 'right';

  const scoreStr = String(Math.floor(score)).padStart(5, '0');
  const hiScoreStr = String(highScore).padStart(5, '0');
  ctx.fillText(`HI ${hiScoreStr}  ${scoreStr}`, CANVAS_WIDTH - 20, 30);
}

// Master Loop
function gameLoop() {
  update();
  draw();
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Inputs & Listeners
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (gameState === 'START' || gameState === 'GAMEOVER') {
      startGame();
    } else if (gameState === 'PLAYING') {
      dino.jump();
    }
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    if (gameState === 'PLAYING') {
      dino.duck(true);
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown') {
    dino.duck(false);
  }
});

restartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

startScreen.addEventListener('click', () => {
  if (gameState === 'START') {
    startGame();
  }
});

// Touch controls for mobile / clicks
touchJumpBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState === 'PLAYING') dino.jump();
  else startGame();
});
touchJumpBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (gameState === 'PLAYING') dino.jump();
  else startGame();
});

touchDuckBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState === 'PLAYING') dino.duck(true);
});
touchDuckBtn.addEventListener('touchend', (e) => {
  e.preventDefault();
  dino.duck(false);
});
touchDuckBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (gameState === 'PLAYING') dino.duck(true);
});
touchDuckBtn.addEventListener('mouseup', (e) => {
  e.preventDefault();
  dino.duck(false);
});

// Initial kick-off
gameLoop();

