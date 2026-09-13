(() => {
  'use strict';

  const COLS = 10, ROWS = 20, SIZE = 30;
  const boardCanvas = document.querySelector('#board');
  const ctx = boardCanvas.getContext('2d');
  const nextCanvas = document.querySelector('#next');
  const nextCtx = nextCanvas.getContext('2d');
  const overlay = document.querySelector('#overlay');
  const startButton = document.querySelector('#startButton');
  const pauseButton = document.querySelector('#pauseButton');
  const scoreEl = document.querySelector('#score');
  const linesEl = document.querySelector('#lines');
  const levelEl = document.querySelector('#level');
  const statusEl = document.querySelector('#status');

  const COLORS = {
    I: '#36d9ff', J: '#5577ff', L: '#ff9d2e', O: '#ffe044',
    S: '#58e486', T: '#a86cff', Z: '#ff4f70'
  };
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]], L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]], S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]], Z: [[1,1,0],[0,1,1],[0,0,0]]
  };

  let grid, piece, nextPiece, bag, score, lines, level, running = false, paused = false;
  let lastTime = 0, dropTimer = 0, frameId;

  function emptyGrid() { return Array.from({ length: ROWS }, () => Array(COLS).fill('')); }
  function refillBag() {
    bag = Object.keys(SHAPES);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  function makePiece() {
    if (!bag || !bag.length) refillBag();
    const type = bag.pop();
    return { type, matrix: SHAPES[type].map(row => [...row]), x: Math.floor((COLS - SHAPES[type][0].length) / 2), y: -1 };
  }
  function resetGame() {
    grid = emptyGrid(); score = 0; lines = 0; level = 1; bag = [];
    piece = makePiece(); nextPiece = makePiece(); updateStats(); draw();
  }
  function startGame() {
    cancelAnimationFrame(frameId); resetGame(); running = true; paused = false;
    overlay.classList.add('hidden'); pauseButton.classList.remove('playing');
    pauseButton.setAttribute('aria-label', 'Pause game');
    statusEl.textContent = 'Game in progress.'; lastTime = performance.now(); dropTimer = 0;
    frameId = requestAnimationFrame(loop);
  }
  function collision(testPiece, dx = 0, dy = 0, matrix = testPiece.matrix) {
    for (let y = 0; y < matrix.length; y++) for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const nx = testPiece.x + x + dx, ny = testPiece.y + y + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && grid[ny][nx])) return true;
    }
    return false;
  }
  function merge() {
    piece.matrix.forEach((row, y) => row.forEach((value, x) => {
      if (value && piece.y + y >= 0) grid[piece.y + y][piece.x + x] = piece.type;
    }));
  }
  function clearLines() {
    let count = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(Boolean)) { grid.splice(y, 1); grid.unshift(Array(COLS).fill('')); count++; y++; }
    }
    if (count) {
      score += [0, 100, 300, 500, 800][count] * level;
      lines += count; level = Math.floor(lines / 10) + 1; updateStats();
      statusEl.textContent = count === 4 ? 'Tetris! Four lines cleared.' : `${count} line${count > 1 ? 's' : ''} cleared.`;
    }
  }
  function lock() {
    merge(); clearLines(); piece = nextPiece; nextPiece = makePiece(); drawNext();
    if (collision(piece)) endGame();
  }
  function move(dx) { if (running && !paused && !collision(piece, dx, 0)) { piece.x += dx; draw(); } }
  function drop(soft = false) {
    if (!running || paused) return;
    if (!collision(piece, 0, 1)) { piece.y++; if (soft) score += 1; }
    else lock();
    if (soft) updateStats(); draw();
  }
  function hardDrop() {
    if (!running || paused) return;
    let distance = 0;
    while (!collision(piece, 0, 1)) { piece.y++; distance++; }
    score += distance * 2; updateStats(); lock(); draw();
  }
  function rotate() {
    if (!running || paused || piece.type === 'O') return;
    const rotated = piece.matrix[0].map((_, i) => piece.matrix.map(row => row[i]).reverse());
    for (const offset of [0, -1, 1, -2, 2]) {
      if (!collision(piece, offset, 0, rotated)) { piece.x += offset; piece.matrix = rotated; draw(); return; }
    }
  }
  function togglePause() {
    if (!running) return;
    paused = !paused; pauseButton.classList.toggle('playing', paused);
    pauseButton.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    if (paused) {
      overlay.classList.remove('hidden'); overlay.querySelector('.overlay-label').textContent = 'Paused';
      overlay.querySelector('h1').innerHTML = 'TAKE<br>FIVE'; startButton.textContent = 'Restart';
      statusEl.textContent = 'Game paused.';
    } else {
      overlay.classList.add('hidden'); statusEl.textContent = 'Game resumed.'; lastTime = performance.now();
      frameId = requestAnimationFrame(loop);
    }
  }
  function endGame() {
    running = false; cancelAnimationFrame(frameId); overlay.classList.remove('hidden');
    overlay.querySelector('.overlay-label').textContent = 'Game over';
    overlay.querySelector('h1').innerHTML = `${String(score).padStart(6, '0')}<br>SCORE`;
    startButton.textContent = 'Play again'; statusEl.textContent = `Game over. Final score ${score}.`;
  }
  function updateStats() {
    scoreEl.textContent = String(score).padStart(6, '0'); linesEl.textContent = lines; levelEl.textContent = level;
  }
  function block(context, x, y, color, size = SIZE, alpha = 1) {
    context.globalAlpha = alpha; context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = 'rgba(255,255,255,.22)'; context.fillRect(x * size + 3, y * size + 3, size - 6, 3);
    context.globalAlpha = 1;
  }
  function draw() {
    ctx.fillStyle = '#0d0f15'; ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * SIZE, 0); ctx.lineTo(x * SIZE, 600); ctx.stroke(); }
    for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * SIZE); ctx.lineTo(300, y * SIZE); ctx.stroke(); }
    grid.forEach((row, y) => row.forEach((type, x) => { if (type) block(ctx, x, y, COLORS[type]); }));
    if (piece) {
      let ghostY = piece.y;
      while (!collision({ ...piece, y: ghostY }, 0, 1)) ghostY++;
      piece.matrix.forEach((row, y) => row.forEach((v, x) => { if (v && ghostY + y >= 0) block(ctx, piece.x + x, ghostY + y, COLORS[piece.type], SIZE, .16); }));
      piece.matrix.forEach((row, y) => row.forEach((v, x) => { if (v && piece.y + y >= 0) block(ctx, piece.x + x, piece.y + y, COLORS[piece.type]); }));
    }
    drawNext();
  }
  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPiece) return;
    const s = 22, matrix = nextPiece.matrix;
    const ox = (nextCanvas.width - matrix[0].length * s) / (2 * s), oy = (nextCanvas.height - matrix.length * s) / (2 * s);
    matrix.forEach((row, y) => row.forEach((v, x) => { if (v) block(nextCtx, ox + x, oy + y, COLORS[nextPiece.type], s); }));
  }
  function loop(time) {
    if (!running || paused) return;
    dropTimer += time - lastTime; lastTime = time;
    if (dropTimer > Math.max(100, 900 - (level - 1) * 70)) { drop(); dropTimer = 0; }
    frameId = requestAnimationFrame(loop);
  }

  document.addEventListener('keydown', event => {
    const actions = { ArrowLeft: () => move(-1), ArrowRight: () => move(1), ArrowUp: rotate, ArrowDown: () => drop(true), ' ': hardDrop, p: togglePause, P: togglePause };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  });
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => ({
    left: () => move(-1), right: () => move(1), rotate, down: () => drop(true), drop: hardDrop
  })[button.dataset.action]()));
  startButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', togglePause);

  const modelContext = document.modelContext;
  if (modelContext?.registerTool) {
    const register = (tool) => {
      try { Promise.resolve(modelContext.registerTool(tool)).catch(() => {}); } catch (_) {}
    };
    register({
      name: 'start_tetris_game',
      title: 'Start Tetris game',
      description: 'Start a fresh game and reset the visible score, lines, and level.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() { startGame(); return { status: 'playing', score, lines, level }; }
    });
    register({
      name: 'control_tetris_piece',
      title: 'Control Tetris piece',
      description: 'Apply one move to the current piece in the active visible game.',
      inputSchema: {
        type: 'object',
        properties: { action: { type: 'string', enum: ['left', 'right', 'rotate', 'soft_drop', 'hard_drop', 'pause'] } },
        required: ['action'], additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || !['left','right','rotate','soft_drop','hard_drop','pause'].includes(input.action)) throw new Error('Invalid action.');
        if (!running && input.action !== 'pause') throw new Error('Start a game before controlling a piece.');
        ({ left: () => move(-1), right: () => move(1), rotate, soft_drop: () => drop(true), hard_drop: hardDrop, pause: togglePause })[input.action]();
        return { status: paused ? 'paused' : running ? 'playing' : 'game_over', score, lines, level };
      }
    });
  }
  resetGame();
})();
