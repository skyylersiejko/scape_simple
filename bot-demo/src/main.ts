import './style.css';
import type { User } from './types';
import { BotGameScreen } from './screens/BotGameScreen';

const app = document.getElementById('app')!;
const LOGO_URL = `${import.meta.env.BASE_URL}cards/Scape_logo.png`;

function showStartScreen(): void {
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:24px;background:rgba(51, 0, 51);">
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
}

function startGame(): void {
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
    if (nav === 'lobby') showStartScreen();
  });

  app.innerHTML = '';
  app.appendChild(screen.getElement());
}

showStartScreen();
