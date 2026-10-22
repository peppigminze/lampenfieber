// Screen state machine (pure). The UI asks canGo/go before switching screens.
export const FLOW = {
  boot: ['title'],
  title: ['select', 'workshop', 'achievements', 'stats', 'settings', 'howto', 'run'],
  select: ['title', 'run'],
  run: ['pause', 'levelup', 'interlude', 'over'],
  pause: ['run', 'settings', 'over', 'howto'],
  levelup: ['run'],
  interlude: ['run', 'levelup'],
  over: ['title', 'select', 'run'],
  workshop: ['title'], achievements: ['title'], stats: ['title'],
  howto: ['title', 'pause'],
  settings: ['title', 'pause'],
};

export function canGo(from, to) { return !!FLOW[from] && FLOW[from].includes(to); }

export function createApp() { return { screen: 'boot', prev: null, history: [] }; }

export function go(app, to) {
  if (!canGo(app.screen, to)) return false;
  app.history.push(app.screen);
  if (app.history.length > 20) app.history.shift();
  app.prev = app.screen; app.screen = to;
  return true;
}
