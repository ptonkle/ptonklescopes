import { DDRAGON, TFT_SET, CHAMPIONS, KEYSTONES, TRAITS } from './data.js';
import { FACTORIO_ITEMS, FACTORIO_TECHS } from './factorio.js';
import { PIKMIN_CREATURES, PIKMIN_TREASURES, PIKMIN_TYPES } from './pikmin.js';
import { POKEMON, POKEMON_ITEMS, POKEMON_MOVES, POKEMON_ABILITIES, GYM_LEADERS } from './pokemon.js';
import { IDLE_SKILLS, IDLE_ITEMS, IDLE_ENEMIES, IDLE_ACTIONS } from './idle.js';
import { SIGNS, LOL, TFT, FACTORIO, PIKMIN, POKE, IDLE } from './texts.js';

const MODES = {
  league: { label: 'League of Legends', read: leagueReading },
  tft: { label: 'Teamfight Tactics', read: tftReading },
  factorio: { label: 'Factorio', read: factorioReading },
  pokemon: { label: 'Pokémon', read: pokemonReading },
  idle: { label: 'Idle Game', read: idleReading, head: idleHead },
  pikmin: {
    label: 'Pikmin',
    read: pikminReading,
    head: () => `${dayBubble()}${sunMeter()}<ul class="lineup">${PIKMIN_TYPES.map((t) => `<li><img src="${esc(t.art)}" alt="${esc(t.name)}"></li>`).join('')}</ul>`,
  },
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

function pikminReading(i) {
  const sign = SIGNS[i];
  const r = rng(`${dayKey()}|pikmin|${sign.key}`);
  const creature = dailyDraw('pikmin', PIKMIN_CREATURES)[i];
  const treasure = dailyDraw('pikmin-treasure', PIKMIN_TREASURES)[i];
  const type = pick(r, PIKMIN_TYPES);
  return {
    headline: pick(r, PIKMIN.headlines),
    lines: [
      pick(r, PIKMIN.creature[creature.category]).replace('{creature}', creature.name),
      pick(r, PIKMIN.treasure).replace('{treasure}', treasure.name),
      pick(r, PIKMIN.type[type.name]),
    ],
    advice: pick(r, PIKMIN.wisdom),
    lucky: [
      ['Explore', pick(r, PIKMIN.areas)],
      ['Avoid', pick(r, PIKMIN.avoid)],
    ],
    art: {
      kind: 'attributes',
      items: [
        { label: 'Creature', name: creature.name, sub: creature.family ? `${creature.family} family` : 'Family unknown', src: creature.art },
        { label: 'Treasure', name: treasure.name, src: treasure.art },
        { label: 'Pikmin', name: type.name, sub: PIKMIN.traits[type.name], src: type.art },
      ],
    },
  };
}

// Names that land on a disambiguation page under their plain title.
const WIKI_PAGES = { Blue: 'Blue (game)', Pearl: 'Pearl (item)', 'Black Belt': 'Black Belt (item)', Metronome: 'Metronome (item)', Apple: 'Apple (item)' };
const bulbapedia = (name) => {
  const page = (WIKI_PAGES[name] ?? name).replaceAll('’', "'").replaceAll(' ', '_');
  return `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(page)}`;
};

function pokemonReading(i) {
  const sign = SIGNS[i];
  const r = rng(`${dayKey()}|pokemon|${sign.key}`);
  const mon = dailyDraw('pokemon', POKEMON)[i];
  const leader = dailyDraw('pokemon-leader', GYM_LEADERS)[i];
  const item = pick(r, POKEMON_ITEMS);
  const move = pick(r, POKEMON_MOVES);
  const ability = pick(r, POKEMON_ABILITIES);
  return {
    headline: pick(r, POKE.headlines),
    lines: [
      pick(r, POKE.pokemon[mon.types[0]]).replace('{pokemon}', mon.name),
      pick(r, POKE.move[move.class]).replace('{move}', move.name),
    ],
    advice: pick(r, POKE.wisdom),
    lucky: [
      ['Hold', item.name, item.art, bulbapedia(item.name)],
      ['Move', move.name, null, bulbapedia(`${move.name} (move)`)],
      ['Ability', ability, null, bulbapedia(`${ability} (Ability)`)],
      ['Avoid', pick(r, POKE.avoid)],
    ],
    art: { kind: 'dex', mon, leader },
function idleReading(i) {
  const sign = SIGNS[i];
  const r = rng(`${dayKey()}|idle|${sign.key}`);
  const skill = dailyDraw('idle', IDLE_SKILLS)[i];
  const item = dailyDraw('idle-item', IDLE_ITEMS)[i];
  const enemy = dailyDraw('idle-enemy', IDLE_ENEMIES)[i];
  const number = (most) => 1 + Math.floor(r() * most);
  return {
    headline: pick(r, IDLE.headlines),
    lines: [
      pick(r, IDLE.skill[skill.key]),
      pick(r, IDLE.item).replace('{item}', item.name),
      pick(r, IDLE.enemy).replace('{enemy}', enemy.name),
    ],
    advice: pick(r, IDLE.wisdom),
    lucky: [
      ['Plan', pick(r, IDLE_ACTIONS)],
      ['Avoid', pick(r, IDLE.avoid)],
    ],
    art: {
      kind: 'attributes',
      items: [
        { label: 'Skill', name: skill.name, sub: skill.group, icon: skill.icon, tag: `Lvl ${number(99)}`, tagKind: 'xp' },
        { label: 'Item', name: item.name, icon: item.icon, tag: `M ${number(99)}`, tagKind: 'mast' },
        { label: 'Enemy', name: enemy.name, icon: enemy.icon, tag: `Kills ${number(999)}`, tagKind: 'hp' },
      ],
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

// The game's heading: today as a save's away limit, then its scene with the figure at work.
function idleHead(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return `<span class="tag xp">${esc(date)}</span>
    <div class="xp-bar"><i style="width:${(minutes / 1440) * 100}%"></i><span><b>Time away</b><b>${Math.floor(minutes / 60)}h ${minutes % 60}m / 24h 0m</b></span></div>
    <div class="idle-scene">
      <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <circle cx="280" cy="22" r="10" class="moon"/>
        <path d="M-999 90H-160Q-120 74 -80 88T0 92Q40 72 80 88T160 84T240 80T320 88T400 82T480 90H1320V120H-999z" class="hill"/>
        <path d="M-999 100H1320V120H-999z" class="ground"/>
        <use href="idle/icons.svg#tree" x="168" y="36" width="72" height="72"/>
        <path d="M88 86L86 103M97 86L99 103" class="leg"/>
        <path d="M82 104h7M96 104h7" class="boot"/>
        <path d="M86 64L80 80" class="limb"/>
        <path d="M80 87L84 61Q92 56 100 61L104 87Z" class="tunic"/>
        <path d="M82 78h21v4h-21z" class="belt"/>
        <circle cx="92" cy="47" r="10" class="skin"/>
        <path d="M82 46Q83 34 93 35Q102 36 102 44Q98 40 92 41Q87 41 82 46z" class="hair"/>
        <circle cx="95" cy="47" r="1.4" class="eye"/><circle cx="100" cy="47" r="1.4" class="eye"/>
        <path d="M96 52q2 1.5 4 0" class="mouth"/>
        <g class="swing">
          <path d="M98 64L112 72" class="limb"/>
          <path d="M108 78L128 52" class="haft"/><path d="M121 47q13-2 13 11l-10-3z" class="blade"/>
          <circle cx="113" cy="72" r="3" class="skin"/>
        </g>
      </svg>
    </div>`;
}

// Pikmin 2's day counter, counting the days of the year. The lettering is drawn
// as tubes: blue shadow, chrome stroke, dark core.
const TUBE_DIGITS = [
  'M12 3C4 3 2 14 2 21C2 31 6 37 12 37C19 37 22 28 22 19C22 10 19 3 12 3Z',
  'M7 9L13 3C13 14 12 26 12 37',
  'M3 11C4 5 9 3 13 3C19 3 21 8 20 13C18 21 8 29 3 36C9 35 16 36 22 35',
  'M4 7C8 2 18 2 19 9C20 15 14 18 9 19C16 19 22 23 21 29C20 37 8 39 3 33',
  'M15 37L15 3C11 11 6 19 2 26C8 26 16 26 23 25',
  'M20 4C15 4 10 4 6 5L5 17C10 14 19 15 21 23C22 32 12 39 3 33',
  'M18 4C10 6 3 15 3 26C3 33 8 37 13 37C19 37 22 31 21 26C19 19 9 19 4 26',
  'M3 5C9 4 16 4 22 4C17 13 12 25 10 37',
  'M12 19C6 17 5 11 6 8C8 2 17 2 19 8C20 13 16 17 12 19C6 22 3 26 4 31C6 38 19 38 20 30C21 25 17 21 12 19Z',
  'M20 13C18 19 8 20 5 13C3 6 10 2 14 3C20 4 21 10 20 14C19 24 16 31 11 37',
];
const TUBE_DAY = 'M6 6C4 14 5 24 6 32M4 6C18 2 30 8 30 18C30 28 18 33 5 32M54 16C46 12 38 16 38 24C38 31 48 33 54 24M54 14C53 20 54 27 57 32M66 14C67 21 71 26 76 26M86 12C80 24 72 36 62 44';

function dayBubble(now = new Date()) {
  const y = now.getFullYear();
  const day = Math.round((Date.UTC(y, now.getMonth(), now.getDate()) - Date.UTC(y, 0, 0)) / 86400000);
  const left = 60 - (String(day).length * 28) / 2 + 2;
  const digits = [...String(day)].map((d, n) => `<path transform="translate(${left + n * 28} 68)" d="${TUBE_DIGITS[d]}"/>`).join('');
  return `<svg class="day-bubble" viewBox="0 0 120 148" role="img" aria-label="Day ${day}">
    <defs>
      <radialGradient id="glass" cx=".5" cy=".42" r=".58"><stop offset=".55" stop-color="#fff" stop-opacity=".03"/><stop offset=".84" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></radialGradient>
      <radialGradient id="shine"><stop offset=".35" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#a4adb8"/><stop offset=".6" stop-color="#f4f7fa"/><stop offset="1" stop-color="#bcc4cd"/></linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="1.4"/></filter>
      <g id="day-num" fill="none" stroke-linecap="round" stroke-linejoin="round">${digits}</g>
      <g id="day-word" fill="none" stroke-linecap="round" stroke-linejoin="round"><path transform="translate(15 2)" d="${TUBE_DAY}"/></g>
    </defs>
    <circle cx="60" cy="90" r="55" fill="url(#glass)"/>
    <circle cx="33" cy="58" r="15" fill="url(#shine)"/>
    <path d="M29 51C37 49 44 43 48 35C49 45 45 55 37 62Z" fill="#fff" filter="url(#soft)"/>
    <use href="#day-word" stroke="url(#chrome)" stroke-width="5.5"/>
    <use href="#day-word" stroke="#3d4a56" stroke-width="1.6"/>
    <use href="#day-num" x="3.5" y="4" stroke="#123a6e" stroke-width="9"/>
    <use href="#day-num" x="3" y="3" stroke="#2f9fd8" stroke-width="5"/>
    <use href="#day-num" stroke="url(#chrome)" stroke-width="8"/>
    <use href="#day-num" stroke="#16263a" stroke-width="2.6"/>
  </svg>`;
}

// The games' day meter: the hand sweeps from sunrise (6am) to sunset (6pm).
function sunMeter(now = new Date()) {
  const day = Math.min(1, Math.max(0, (now.getHours() + now.getMinutes() / 60 - 6) / 12));
  const dots = [0, 1, 2, 3, 4, 5, 6].map((n) => {
    const a = Math.PI * (1 - n / 6);
    return `<circle cx="${60 + 40 * Math.cos(a)}" cy="${62 - 40 * Math.sin(a)}" r="2.6" fill="#fff"/>`;
  }).join('');
  const ray = (a) => `<path d="M60 44 L54 60 L66 60 Z" fill="#ffc933" transform="rotate(${a} 60 60)"/>`;
  return `<svg class="sun-meter" viewBox="0 0 120 70" role="img" aria-label="Time of day">
    <path d="M6 66 A54 54 0 0 1 114 66 Z" fill="url(#dial)" stroke="#c9d3da" stroke-width="5" stroke-linejoin="round"/>
    <path d="M60 62 L103 62 A43 43 0 0 0 97 40 Z" fill="#d81b52"/>
    <defs><linearGradient id="dial" x1="0" x2="1"><stop offset="0" stop-color="#1c5f8c"/><stop offset="1" stop-color="#071d33"/></linearGradient></defs>
    ${dots}
    <path d="M60 58 L60 66 L104 62 Z" fill="#e8eef2" transform="rotate(${180 * (day - 1)} 60 62)"/>
    ${[0, 45, 90, 135, 180, 225, 270, 315].map(ray).join('')}
    <circle cx="60" cy="60" r="9" fill="#ffdf6b" stroke="#e8a21c" stroke-width="2"/>
  </svg>`;
}

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const main = $('#main');
const wikiLink = (text, href) => `<a class="wiki" href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`;

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
      ${MODES[mode].head?.() ?? `<p class="dateline">${esc(date)}${sub ? ` <span class="sep">·</span> ${esc(sub)}` : ''}</p>`}
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
  const figure = a.kind === 'dex'
    ? `<div class="art dex">
         <div class="dex-screen">
           <img class="trim" crossorigin="anonymous" src="${esc(a.mon.art)}" alt="${esc(a.mon.name)}">
           <p class="dex-no">No. ${String(a.mon.dex).padStart(4, '0')}</p>
         </div>
         <div class="dex-name">
           <strong>${wikiLink(a.mon.name, bulbapedia(`${a.mon.name} (Pokémon)`))}</strong><em>${esc(a.mon.genus)}</em><small>${esc(a.mon.types.join(' / '))}</small>
           <button class="cry" aria-label="Play cry"></button>
         </div>
         <div class="dex-leader">
           <img class="${a.leader.pixel ? 'pixel trim' : ''}" src="${esc(a.leader.art)}" alt="${esc(a.leader.name)}">
           <div><small>${esc(a.leader.role)}</small><strong>${wikiLink(a.leader.name, bulbapedia(a.leader.name))}</strong><em>${esc(a.leader.type)} · ${esc(a.leader.city)}</em></div>
         </div>
       </div>`
    : a.kind === 'attributes'
    ? `<ul class="art attributes">${a.items.map((t) => `
         <li>
           ${t.tag ? `<span class="tag ${esc(t.tagKind)}">${esc(t.tag)}</span>` : ''}
           <div class="attr-frame">${t.icon
             ? `<svg viewBox="0 0 40 40" role="img" aria-label="${esc(t.name)}"><use href="idle/icons.svg#${esc(t.icon)}"/></svg>`
             : `<img src="${esc(t.src)}" alt="${esc(t.name)}">`}</div>
           <div class="attr-text"><small>${esc(t.label)}</small><strong>${esc(t.name)}</strong>${t.sub ? `<em>${esc(t.sub)}</em>` : ''}</div>
         </li>`).join('')}
       </ul>`
    : a.kind === 'icon'
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
        <div class="say">
          <h3>${esc(rd.headline)}</h3>
          ${rd.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
          <p class="advice">${esc(rd.advice)}</p>
        </div>
        <dl class="lucky">${rd.lucky.map(([k, v, icon, href]) => `<div><dt>${esc(k)}</dt><dd>${icon ? `<img src="${esc(icon)}" alt="">` : ''}${href ? wikiLink(v, href) : esc(v)}</dd></div>`).join('')}</dl>
      </div>
    </div>`;
}

// --- Expand / collapse ---

const reveal = $('#reveal');
const panel = $('#reveal .panel');
const content = $('#reveal .content');
let openFrom = null;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Pokémon cries: one plays when a reading opens. Volume is kept between visits.
let volume = 0.5;
try { volume = Number(localStorage.getItem('volume') ?? volume); } catch { /* storage blocked */ }
const cry = new Audio();

function playCry(src) {
  cry.src = src;
  cry.volume = volume;
  cry.play().catch(() => {});
}

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

// Sprites sit in empty margins: crop to the drawn pixels so they fill their screens.
function trimSprite(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const { data } = g.getImageData(0, 0, c.width, c.height);
  let [left, top, right, bottom] = [c.width, c.height, 0, 0];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) return;
  const out = document.createElement('canvas');
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext('2d').drawImage(c, -left, -top);
  img.onload = null;
  img.src = out.toDataURL();
}

function open(btn) {
  const i = Number(btn.dataset.i);
  const rd = MODES[currentMode()].read(i);
  content.innerHTML = readingHTML(SIGNS[i], rd);
  for (const img of content.querySelectorAll('img')) img.onerror = () => img.remove();
  for (const img of content.querySelectorAll('img.trim')) {
    if (img.complete && img.naturalWidth) trimSprite(img);
    else img.onload = () => trimSprite(img);
  }
  openFrom = btn;
  reveal.hidden = false;
  document.body.classList.add('locked');
  content.scrollTop = 0;
  flip(btn, false);
  $('.close', panel).focus({ preventScroll: true });
  if (rd.art.mon) playCry(rd.art.mon.cry);
}

async function close() {
  if (reveal.hidden) return;
  cry.pause();
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
  if (e.target.closest('.cry')) { cry.currentTime = 0; cry.play().catch(() => {}); }
});
const volumeSlider = $('#volume');
volumeSlider.value = volume;
volumeSlider.addEventListener('input', () => {
  volume = cry.volume = Number(volumeSlider.value);
  try { localStorage.setItem('volume', volume); } catch { /* storage blocked */ }
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
addEventListener('hashchange', () => { reveal.hidden = true; document.body.classList.remove('locked'); renderPage(); });

renderPage();
loadLiveChampions();
