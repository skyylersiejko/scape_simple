import './style.css';
import type { User } from './types';
import { BotGameScreen } from './screens/BotGameScreen';
import { WillowAI } from './game/ai';

const app = document.getElementById('app')!;
const LOGO_URL = `${import.meta.env.BASE_URL}cards/Scape_logo.png`;

function lrToLabel(rate: number): string {
  if (rate <= 0.2) return 'Cautious';
  if (rate <= 0.4) return 'Careful';
  if (rate <= 0.6) return 'Balanced';
  if (rate <= 0.8) return 'Fast';
  return 'Aggressive';
}

function buildWillowWidget(): string {
  const w = new WillowAI();
  const s = w.getStats();
  const hasModel = s.gamesPlayed > 0;
  const confidence = hasModel
    ? Math.min(99, Math.round((1 - parseFloat(s.explorationRate) / 100) * 100))
    : 0;

  const lr = WillowAI.getLearningRate();
  const lrPct = Math.round(lr * 100);
  const lrLabel = lrToLabel(lr);

  // Progress bar fill based on patterns learned (cap display at 500)
  const learnPct = Math.min(100, Math.round(s.patternsLearned / 5));

  const statusDot = hasModel
    ? `<span style="color:var(--green)">●</span>`
    : `<span style="color:var(--text-dim)">○</span>`;

  return `
    <div id="willow-widget" style="
      position:absolute;top:16px;right:16px;
      background:var(--bg2);border:2px solid var(--border);
      box-shadow:3px 3px 0 var(--purple),inset 0 0 0 1px rgba(122,58,237,0.15);
      padding:20px 22px;min-width:320px;max-width:380px;
      font-family:'Share Tech Mono',monospace;
    ">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:20px">🌿</span>
        <span style="font-family:'Press Start 2P',monospace;font-size:12px;color:var(--gold);letter-spacing:1px">WILLOW AI</span>
        ${statusDot}
      </div>

      <div style="font-size:14px;color:var(--text-dim);line-height:2.2">
        <div style="display:flex;justify-content:space-between">
          <span>Games</span>
          <span style="color:var(--text)">${s.gamesPlayed}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span>Win rate</span>
          <span style="color:${hasModel ? 'var(--green)' : 'var(--text-dim)'}">${s.winRate}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span>Confidence</span>
          <span style="color:var(--cyan)">${confidence}%</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span>Size</span>
          <span style="color:var(--text)">${s.modelSizeKB > 0 ? s.modelSizeKB + 'KB' : '—'}</span>
        </div>
      </div>

      <div style="margin:12px 0 8px;height:6px;background:var(--bg3);border:1px solid var(--border)">
        <div style="height:100%;width:${learnPct}%;background:var(--purple-light);transition:width .3s"></div>
      </div>
      <div style="font-size:11px;color:var(--text-dim);text-align:right">${s.patternsLearned} patterns learned</div>

      <div style="margin:14px 0 6px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:12px;color:var(--text-dim)">Learning Speed</span>
          <span id="lr-label" style="font-size:12px;color:var(--cyan)">${lrLabel}</span>
        </div>
        <input id="lr-slider" type="range" min="0" max="100" value="${lrPct}" style="
          width:100%;height:6px;-webkit-appearance:none;appearance:none;
          background:linear-gradient(to right,var(--purple-dark),var(--gold));
          border-radius:2px;outline:none;cursor:pointer;
        " />
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-size:9px;color:var(--text-dim)">Cautious</span>
          <span style="font-size:9px;color:var(--text-dim)">Aggressive</span>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:14px">
        <button id="btn-w-import" class="btn-gold" style="flex:1;padding:8px;font-size:11px">⬆ Load</button>
        <button id="btn-w-export" class="btn-gold" style="flex:1;padding:8px;font-size:11px" ${!hasModel ? 'disabled' : ''}>⬇ Save</button>
        <button id="btn-w-reset" class="btn-danger" style="flex:1;padding:8px;font-size:11px" ${!hasModel ? 'disabled' : ''}>✕</button>
      </div>
    </div>
  `;
}

function attachWillowWidgetListeners(): void {
  // Learning rate slider
  const slider = document.getElementById('lr-slider') as HTMLInputElement | null;
  const label = document.getElementById('lr-label');
  slider?.addEventListener('input', () => {
    const rate = parseInt(slider.value, 10) / 100;
    WillowAI.setLearningRate(rate);
    if (label) label.textContent = lrToLabel(rate);
  });

  document.getElementById('btn-w-export')?.addEventListener('click', () => {
    const w = new WillowAI();
    const json = w.exportModel();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `willow-model-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-w-import')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const w = new WillowAI();
        const ok = w.importModel(reader.result as string);
        if (ok) {
          showStartScreen();
        } else {
          alert('Invalid or incompatible Willow model file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  document.getElementById('btn-w-reset')?.addEventListener('click', () => {
    if (confirm('Reset all Willow learning data? This cannot be undone.')) {
      const w = new WillowAI();
      w.resetModel();
      showStartScreen();
    }
  });
}

function showStartScreen(): void {
  teardownActiveGame();
  app.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:24px;background:rgba(51, 0, 51);">
      ${buildWillowWidget()}
      <img src="${LOGO_URL}" alt="Scape" style="max-width:min(420px,80vw);height:auto;" />
      <button id="btn-play" style="
        font-family:'Press Start 2P',monospace;
        font-size:14px;
        padding:16px 48px;
        background:var(--gold,#ffd700);
        color:#000;
        border:2px solid var(--gold,#ffd700);
        cursor:pointer;
      ">Start</button>
    </div>
  `;
  document.getElementById('btn-play')!.addEventListener('click', startGame);
  attachWillowWidgetListeners();
}

/**
 * The game screen currently mounted, if any. Kept so it can be torn down: without
 * this, leaving a game to the lobby left its watchdog interval, mousemove listener
 * and spacebar listener alive, so a second game ran with two of each.
 */
let activeGame: BotGameScreen | null = null;

function teardownActiveGame(): void {
  if (!activeGame) return;
  activeGame.destroy();
  activeGame = null;
}

function startGame(): void {
  teardownActiveGame();

  const guest: User = {
    uid: `guest_${Date.now()}`,
    username: 'Player',
    rank: 100,
    wins: 0,
    losses: 0,
    online: true,
    lastSeen: Date.now(),
    friends: [],
    avatarColor: '#00ff88',
  };

  const screen = new BotGameScreen(guest, (nav: string) => {
    if (nav === 'lobby') {
      teardownActiveGame();
      showStartScreen();
    }
  });
  activeGame = screen;

  app.innerHTML = '';
  app.appendChild(screen.getElement());
}

showStartScreen();
