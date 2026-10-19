import { DDRAGON, TFT_SET, CHAMPIONS, KEYSTONES, TRAITS } from './data.js';
import { FACTORIO_ITEMS, FACTORIO_TECHS } from './factorio.js';
import { SIGNS, LOL, TFT, FACTORIO } from './texts.js';

const MODES = {
  league: { label: 'League of Legends', read: leagueReading },
  tft: { label: 'Teamfight Tactics', read: tftReading },
  factorio: { label: 'Factorio', read: factorioReading },
};
const TEXT_GLYPH = '︎'; // keep zodiac glyphs as text, not emoji

// Baked-in champions, replaced by the live Data Dragon list when it loads,
// so new champions show up without a rebuild.
let champions = CHAMPIONS;
let patch = DDRAGON;

async function loadLiveChampions() {
  try {
    const versions = await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json();
    if (versions[0] === DDRAGON) return;
    const data = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/en_US/champion.json`)).json()).data;
    champions = Object.values(data)
      .map((c) => ({ id: c.id, name: c.name, title: c.title, tags: c.tags }))
      .sort((a, b) => a.name.localeCompare(b.name));
    patch = versions[0];
    if (reveal.hidden) renderPage();
  } catch {
    // Offline or blocked: keep the baked list.
  }
}

// --- Seeded randomness: same reading for everyone, all day ---

function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, list) => list[Math.floor(r() * list.length)];

function shuffled(r, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// --- Readings ---

// Each sign gets a different champion / trait on a given day.
function dailyDraw(mode, pool) {
  return shuffled(rng(`${dayKey()}|${mode}|draw`), pool).slice(0, SIGNS.length);
}

function leagueReading(i) {
  const sign = SIGNS[i];
  const r = rng(`${dayKey()}|league|${sign.key}`);
  const champ = dailyDraw('league', champions)[i];
  const tag = champ.tags[0] in LOL.champ ? champ.tags[0] : 'Fighter';
  const fits = KEYSTONES.filter((k) => LOL.keystones[tag].includes(k.key));
  const rune = pick(r, fits.length ? fits : KEYSTONES);
  return {
    headline: pick(r, LOL.headlines),
    lines: [
      pick(r, LOL.champ[tag]).replace('{champ}', champ.name),
      LOL.keystone[rune.key] ? pick(r, LOL.keystone[rune.key]) : LOL.keystoneAny.replace('{rune}', rune.name),
      pick(r, LOL.game),
    ],
    advice: pick(r, LOL.advice),
    lucky: [
      ['Item', pick(r, LOL.items)],
      ['Avoid', pick(r, LOL.avoid)],
    ],
    art: {
      kind: 'portrait',
      src: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champ.id}_0.jpg`,
      label: 'Ascending champion',
      name: champ.name,
      sub: champ.title,
      rune,
    },
  };
}

function factorioReading(i) {
  const sign = SIGNS[i];
  const r = rng(`${dayKey()}|factorio|${sign.key}`);
  const item = dailyDraw('factorio', FACTORIO_ITEMS)[i];
  const tech = pick(r, FACTORIO_TECHS);
  const [wisdom, motto] = shuffled(r, FACTORIO.wisdom);
  return {
    headline: pick(r, FACTORIO.headlines),
    lines: [
      pick(r, FACTORIO.item[item.category]).replace('{item}', item.name),
      pick(r, FACTORIO.session),
      wisdom,
    ],
    advice: motto,
    lucky: [
      ['Research next', tech.name, tech.icon],
      ['Avoid', pick(r, FACTORIO.avoid)],
    ],
    art: {
      kind: 'icon',
      src: item.icon,
      label: 'Ascending item',
      name: item.name,
      sub: FACTORIO.categories[item.category],
    },
  };
}

function tftReading(i) {
  const sign = SIGNS[i];
  const r = rng(`${dayKey()}|tft|${sign.key}`);
  const trait = dailyDraw('tft', TRAITS)[i];
  const unit = pick(r, trait.units);
  return {
    headline: pick(r, TFT.headlines),
    lines: [
      TFT.trait[trait.name] ? pick(r, TFT.trait[trait.name]) : pick(r, TFT.traitAny).replace('{trait}', trait.name),
      pick(r, TFT.carry).replace('{unit}', unit.name),
      pick(r, TFT.game),
    ],
    advice: pick(r, TFT.advice),
    lucky: [
      ['Roll at', pick(r, TFT.rollAt)],
      ['Item', pick(r, TFT.items)],
      ['Avoid', pick(r, TFT.avoid)],
    ],
    art: {
      kind: 'banner',
      src: unit.art,
      icon: trait.icon,
      label: 'Ascending trait',
      name: trait.name,
      sub: unit.name,
      units: trait.units,
    },
  };
}

// --- Rendering ---

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const main = $('#main');

function currentMode() {
  const m = location.hash.replace('#/', '');
  return MODES[m] ? m : 'league';
}

function renderPage() {
  const mode = currentMode();
  document.body.dataset.mode = mode;
  for (const a of document.querySelectorAll('.modes a')) {
    a.toggleAttribute('aria-current', a.dataset.mode === mode);
  }
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const sub = {
    league: `Patch ${patch.split('.').slice(0, 2).join('.')}`,
    tft: `Set ${TFT_SET.number} · ${TFT_SET.name}`,
  }[mode];
  main.innerHTML = `
    <div class="page-head">
      <h1>${esc(MODES[mode].label)}</h1>
      <p class="dateline">${esc(date)}${sub ? ` <span class="sep">·</span> ${esc(sub)}` : ''}</p>
    </div>
    <ol class="grid">
      ${SIGNS.map((s, i) => `
        <li><button class="sign" data-i="${i}">
          <span class="glyph">${s.glyph}${TEXT_GLYPH}</span>
          <span class="name">${s.name}</span>
          <span class="dates">${s.dates}</span>
        </button></li>`).join('')}
    </ol>`;
}

function readingHTML(sign, rd) {
  const a = rd.art;
  const figure = a.kind === 'icon'
    ? `<figure class="art icon">
         <div class="icon-frame"><img src="${esc(a.src)}" alt="${esc(a.name)}"></div>
         <figcaption><small>${esc(a.label)}</small><strong>${esc(a.name)}</strong><em>${esc(a.sub)}</em></figcaption>
       </figure>`
    : a.kind === 'portrait'
    ? `<figure class="art portrait">
         <img src="${esc(a.src)}" alt="${esc(a.name)}">
         <figcaption><small>${esc(a.label)}</small><strong>${esc(a.name)}</strong><em>${esc(a.sub)}</em></figcaption>
         <div class="rune"><img src="${esc(a.rune.icon)}" alt=""><span><small>Keystone</small><b>${esc(a.rune.name)}</b></span></div>
       </figure>`
    : `<figure class="art banner">
         <figcaption>
           <img class="trait-icon" src="${esc(a.icon)}" alt="">
           <span><small>${esc(a.label)}</small><strong>${esc(a.name)}</strong></span>
         </figcaption>
         ${a.units.length < 2 ? "" : `<ul class="units">${a.units.map((u) => `
           <li class="cost-${u.cost}" title="${esc(u.name)}"><img src="${esc(u.tile)}" alt="${esc(u.name)}"></li>`).join('')}
         </ul>`}
       </figure>`;
  return `
    <header class="reading-head">
      <span class="glyph">${sign.glyph}${TEXT_GLYPH}</span>
      <div><h2>${esc(sign.name)}</h2><p class="dates">${esc(sign.dates)}</p></div>
    </header>
    ${a.kind === 'banner' ? `<img class="splash" src="${esc(a.src)}" alt="${esc(a.sub)}">` : ''}
    <div class="reading-body">
      ${figure}
      <div class="words">
        <h3>${esc(rd.headline)}</h3>
        ${rd.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
        <p class="advice">${esc(rd.advice)}</p>
        <dl class="lucky">${rd.lucky.map(([k, v, icon]) => `<div><dt>${esc(k)}</dt><dd>${icon ? `<img src="${esc(icon)}" alt="">` : ''}${esc(v)}</dd></div>`).join('')}</dl>
      </div>
    </div>`;
}

// --- Expand / collapse ---

const reveal = $('#reveal');
const panel = $('#reveal .panel');
const content = $('#reveal .content');
let openFrom = null;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function flip(from, reverse) {
  const a = from.getBoundingClientRect();
  const b = panel.getBoundingClientRect();
  const t = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`;
  const frames = [{ transform: t, opacity: 0.4 }, { transform: 'none', opacity: 1 }];
  return panel.animate(reverse ? frames.reverse() : frames, {
    duration: reduceMotion.matches ? 0 : 380,
    easing: 'cubic-bezier(.2,.8,.2,1)',
    fill: 'both',
  }).finished;
}

function open(btn) {
  const i = Number(btn.dataset.i);
  content.innerHTML = readingHTML(SIGNS[i], MODES[currentMode()].read(i));
  for (const img of content.querySelectorAll('img')) img.onerror = () => img.remove();
  openFrom = btn;
  reveal.hidden = false;
  document.body.classList.add('locked');
  content.scrollTop = 0;
  flip(btn, false);
  $('.close', panel).focus({ preventScroll: true });
}

async function close() {
  if (reveal.hidden) return;
  const from = openFrom;
  reveal.classList.add('closing');
  if (from) await flip(from, true);
  reveal.hidden = true;
  reveal.classList.remove('closing');
  panel.getAnimations().forEach((a) => a.cancel());
  document.body.classList.remove('locked');
  from?.focus({ preventScroll: true });
}

main.addEventListener('click', (e) => {
  const btn = e.target.closest('.sign');
  if (btn) open(btn);
});
reveal.addEventListener('click', (e) => {
  if (e.target === reveal || e.target.closest('.close')) close();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
addEventListener('hashchange', () => { reveal.hidden = true; document.body.classList.remove('locked'); renderPage(); });

renderPage();
loadLiveChampions();
