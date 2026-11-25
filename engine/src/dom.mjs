// Browser layer: mounts the virtual trees, runs the clock, overlays (title, decisions, end), keyboard,
// scaling and the test hooks of D13.7. The only module that touches the DOM.
import { prepare, createPlayer, keyToOption, wrapText } from './core.mjs';
import { buildSceneView } from './draw/scene.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';

function tciaParseHash(hash) {
  const out = { auto: null, stop: null };
  const m = /(?:^#|[#&])tcia=([^&]*)/.exec(hash || '');
  if (!m) return out;
  let body = m[1];
  try { body = decodeURIComponent(body); } catch (e) { return out; }
  for (const part of body.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i);
    const v = part.slice(i + 1);
    if (k === 'auto') {
      if (/^\d+(\.\d+)*$/.test(v)) out.auto = v.split('.').map((x) => Math.max(1, parseInt(x, 10)));
      else if (v === '') out.auto = [];
    } else if (k === 'stop') {
      const mm = /^(title|deciding|ended)(?:@(\d+))?$/.exec(v);
      if (mm) out.stop = { state: mm[1], n: mm[2] ? Math.max(1, parseInt(mm[2], 10)) : 1 };
    }
  }
  return out;
}

function tciaMount(node, keyed) {
  if (typeof node === 'string') return document.createTextNode(node);
  const el = document.createElementNS(SVG_NS, node.tag);
  const attrs = node.attrs;
  for (const k in attrs) {
    const v = attrs[k];
    if (v !== undefined && v !== null) el.setAttribute(k, v);
  }
  if (node.k) keyed[node.k] = { el, cache: {} };
  for (const c of node.children) el.appendChild(tciaMount(c, keyed));
  return el;
}

function tciaApply(keyed, updates) {
  for (const key in updates) {
    const rec = keyed[key];
    if (!rec) continue;
    const u = updates[key];
    for (const a in u) {
      const v = u[a];
      if (rec.cache[a] === v) continue;
      rec.cache[a] = v;
      if (a === '$order') {
        // z-order: move the keyed children to the end, in this order
        for (const k of String(v).split(',')) { const c = keyed[k]; if (c && c.el.parentNode === rec.el) rec.el.appendChild(c.el); }
        continue;
      }
      if (v === null || v === undefined) rec.el.removeAttribute(a);
      else rec.el.setAttribute(a, v);
    }
  }
}

// free band for buttons: below the ground line, or the top band when a character reaches down there
// bands for the decision and end buttons (R1): under the ground line, or along the top when a
// character reaches below the ground
export const TCIA_BANDS = { bottom: [926, 1066], top: [24, 164] };

export function tciaBandFor(boxes) {
  const b = TCIA_BANDS.bottom;
  for (const x of boxes) {
    for (const r of [x.body, x.head]) if (r && r[3] > b[0] && r[1] < b[1]) return 'top';
  }
  return 'bottom';
}

export function tciaBoot() {
  const root = document.documentElement;
  const stage = document.getElementById('stage');
  let errors = 0;
  const setAttr = (k, v) => { if (v === null || v === undefined || v === '') root.removeAttribute(k); else root.setAttribute(k, String(v)); };
  const bump = () => { errors++; root.setAttribute('data-tcia-errors', String(errors)); };
  root.setAttribute('data-tcia-errors', '0');
  window.addEventListener('error', bump);
  window.addEventListener('unhandledrejection', bump);
  const origError = console.error;
  console.error = function patchedError() { bump(); return origError.apply(console, arguments); };

  const fail = (msg) => {
    setAttr('data-tcia-state', 'error');
    const box = document.getElementById('tcia-error');
    box.textContent = msg;
    box.hidden = false;
  };

  const scriptEl = document.getElementById('tcia-script');
  const raw = scriptEl ? scriptEl.textContent : '';
  if (raw.trim() === '__TCIA_' + 'SCRIPT_JSON__') { fail('TCIA engine template: no script was injected.'); return; }
  let catalog;
  let story;
  try {
    catalog = JSON.parse(document.getElementById('tcia-catalog').textContent);
    story = prepare(JSON.parse(raw), catalog);
  } catch (e) {
    fail('TCIA: the script could not be loaded. ' + (e && e.message ? e.message : ''));
    bump();
    return;
  }
  document.title = story.meta.title;
  root.setAttribute('lang', story.meta.lang);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1920 1080');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  stage.insertBefore(svg, stage.firstChild);
  const fade = document.getElementById('tcia-fade');
  const veil = document.getElementById('tcia-veil');
  const titleBox = document.getElementById('tcia-title');
  const titleText = document.getElementById('tcia-title-text');
  const startBtn = document.getElementById('tcia-start');
  const decisionBox = document.getElementById('tcia-decision');
  const endBox = document.getElementById('tcia-end');
  const restartBtn = document.getElementById('tcia-restart');
  const startBox = document.getElementById('tcia-startbar');
  // a keyboard click only counts after a key was pressed on this page (a key held while the page
  // loads must not start the story by itself)
  let armed = false;
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') armed = true; }, true);

  titleText.textContent = '';
  for (const line of wrapText(story.meta.title, 30)) {
    const span = document.createElement('span');
    span.textContent = line;
    titleText.appendChild(span);
  }
  startBtn.textContent = story.ui.start;
  restartBtn.textContent = story.ui.restart;
  decisionBox.setAttribute('aria-label', story.ui.decision);

  const player = createPlayer(story);
  const hash = tciaParseHash(location.hash);
  let view = null;
  let keyed = {};
  let mountedScene = null;
  const reached = { title: 0, deciding: 0, ended: 0 };
  let frozen = false;

  // each scene is built once (planning its balloons takes a moment) and kept; the ones not shown yet
  // are built in the background, one per tick, while the title is up
  const views = {};
  const viewFor = (id) => views[id] || (views[id] = buildSceneView(story, id));
  const pending = Object.keys(story.scenes);
  const warm = () => {
    while (pending.length && views[pending[0]]) pending.shift();
    if (!pending.length) return;
    viewFor(pending.shift());
    setTimeout(warm, 0);
  };
  setTimeout(warm, 30);

  function mountScene(id) {
    view = viewFor(id);
    view.reset();
    keyed = {};
    const el = tciaMount(view.tree, keyed);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.appendChild(el);
    mountedScene = id;
  }

  function placeBand(el) {
    const band = tciaBandFor(view ? view.boxes() : []);
    el.classList.toggle('band-top', band === 'top');
  }

  function showOverlay(state) {
    titleBox.hidden = state !== 'title';
    endBox.hidden = state !== 'ended';
    decisionBox.hidden = state !== 'deciding';
    if (state === 'deciding') placeBand(decisionBox);
    if (state === 'ended') placeBand(endBox);
    if (state === 'title') placeBand(startBox);
    veil.className = 'veil veil-' + state;
    veil.hidden = !(state === 'title' || state === 'deciding' || state === 'ended');
    if (state !== 'deciding') while (decisionBox.firstChild) decisionBox.removeChild(decisionBox.firstChild);
  }

  function buildDecision() {
    while (decisionBox.firstChild) decisionBox.removeChild(decisionBox.firstChild);
    const row = document.createElement('div');
    row.className = 'row count-' + player.options.length;
    decisionBox.appendChild(row);
    player.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.style.animationDelay = (i * 0.12).toFixed(2) + 's';
      const n = document.createElement('span');
      n.className = 'num';
      n.textContent = String(i + 1);
      const l = document.createElement('span');
      l.className = 'label';
      l.textContent = o.label;
      b.appendChild(n);
      b.appendChild(l);
      b.addEventListener('click', (e) => { if (e.detail === 0 && !armed) return; choose(i); });
      row.appendChild(b);
    });
    const first = decisionBox.querySelector('button');
    if (first) first.focus();
  }

  function syncHooks() {
    setAttr('data-tcia-state', player.state);
    setAttr('data-tcia-scene', player.sceneId);
    setAttr('data-tcia-decision', player.state === 'deciding' ? player.decisionId : null);
    const ch = Object.keys(player.choices).map((k) => k + '=' + player.choices[k]).join(',');
    setAttr('data-tcia-choices', ch);
    setAttr('data-tcia-ending', player.endingId);
  }

  function onState(state) {
    showOverlay(state);
    if (state === 'deciding') buildDecision();
    if (state === 'ended') restartBtn.focus();
    if (state === 'title') startBtn.focus();
    if (reached[state] !== undefined) {
      reached[state]++;
      if (hash.stop && hash.stop.state === state && reached[state] === hash.stop.n) { frozen = true; root.setAttribute('data-tcia-frozen', state); writeBoxes(); }
    }
  }

  function handleEvents(events) {
    for (const ev of events) {
      if (ev.type === 'decision') onState('deciding');
      else if (ev.type === 'ended') onState('ended');
      else if (ev.type === 'scene' || ev.type === 'choice') showOverlay(player.state);
    }
  }

  function render() {
    const f = player.frame();
    if (f.sceneId !== mountedScene) mountScene(f.sceneId);
    tciaApply(keyed, view.update(f));
    fade.style.opacity = f.fade > 0 ? f.fade.toFixed(3) : '0';
    syncHooks();
    if (frozen) writeBoxes();
  }

  // test hook (with #tcia=stop:…): boxes of the visible buttons, measured in the DOM, and of the
  // characters, measured on the drawing, all in viewBox coordinates
  function writeBoxes() {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const k = 1920 / r.width;
    const buttons = [];
    for (const b of stage.querySelectorAll('button')) {
      if (b.offsetParent === null) continue;
      const q = b.getBoundingClientRect();
      if (!q.width) continue;
      buttons.push([(q.left - r.left) * k, (q.top - r.top) * k, (q.right - r.left) * k, (q.bottom - r.top) * k].map((v) => Math.round(v * 10) / 10));
    }
    const round = (bx) => (bx ? bx.map((v) => Math.round(v * 10) / 10) : null);
    const actors = (view ? view.boxes() : []).map((x) => ({ id: x.id, body: round(x.body), head: round(x.head) }));
    root.setAttribute('data-tcia-boxes', JSON.stringify({ buttons, actors }));
  }

  function choose(i) {
    if (player.state !== 'deciding' || frozen) return;
    player.choose(i);
    handleEvents(player.advance(0.0001));
    render();
  }

  function start() {
    if (player.state !== 'title' || frozen) return;
    player.start();
    handleEvents(player.advance(0.0001));
    render();
  }

  startBtn.addEventListener('click', (e) => { if (e.detail === 0 && !armed) return; start(); });
  restartBtn.addEventListener('click', (e) => {
    if (e.detail === 0 && !armed) return;
    if (player.state !== 'ended' || frozen) return;
    player.restart();
    handleEvents(player.advance(0.0001));
    render();
  });
  document.addEventListener('keydown', (e) => {
    if (player.state !== 'deciding') return;
    let i = keyToOption(e.code, player.options.length);
    if (i < 0) i = keyToOption(e.key, player.options.length);
    if (i >= 0) { e.preventDefault(); choose(i); }
  });

  // first paint: title (or straight into the story in auto mode)
  render();
  onState('title');
  syncHooks();
  if (hash.auto && !frozen) {
    player.start();
    handleEvents(player.advance(0.0001));
    render();
  }

  if (hash.auto) {
    // simulated clock: steps of 1/15 s, drawing every step, in batches of 10 with setTimeout(0)
    const picks = hash.auto;
    let decisionsSeen = 0;
    let steps = 0;
    let busy = 0;
    const tick = () => {
      for (let k = 0; k < 10; k++) {
        if (frozen || player.state === 'ended') { if (steps) root.setAttribute('data-tcia-frame-ms', (busy / steps).toFixed(3)); return; }
        if (player.state === 'deciding') {
          const pick = (picks[decisionsSeen] || 1) - 1;
          decisionsSeen++;
          choose(Math.min(pick, player.options.length - 1));
          continue;
        }
        const t0 = performance.now();
        handleEvents(player.advance(1 / 15));
        render();
        busy += performance.now() - t0;
        steps++;
      }
      root.setAttribute('data-tcia-frame-ms', (busy / Math.max(1, steps)).toFixed(3));
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
    return;
  }

  // real clock
  let last = null;
  document.addEventListener('visibilitychange', () => { last = null; });
  const loop = (now) => {
    if (document.hidden) { last = null; requestAnimationFrame(loop); return; }
    if (last === null) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (!frozen) {
      handleEvents(player.advance(dt));
      render();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
