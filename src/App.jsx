import { useState, useEffect, useMemo, useCallback } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const STORAGE_KEY = 'math-dungeon-v1';
const PREFS_KEY = 'math-dungeon-prefs-v1';
const APP_VERSION = '0.2.0';
const MAX_PLAYER_HP = 5;

const OP_OPTIONS = [
  { id: '+', label: '+', name: 'Add' },
  { id: '-', label: '−', name: 'Subtract' },
  { id: '×', label: '×', name: 'Multiply' },
  { id: '÷', label: '÷', name: 'Divide' },
];

const DIFFICULTY_PRESETS = [
  { id: 'easy', name: 'Easy', ops: ['+'], maxNumber: 5 },
  { id: 'medium', name: 'Medium', ops: ['+', '-'], maxNumber: 10 },
  { id: 'hard', name: 'Hard', ops: ['+', '-'], maxNumber: 20 },
  { id: 'challenging', name: 'Challenging', ops: ['+', '-', '×'], maxNumber: 12 },
  { id: 'expert', name: 'Expert', ops: ['+', '-', '×', '÷'], maxNumber: 20 },
];

const MIN_RANGE = 2;
const MAX_RANGE = 100;

const DEFAULT_PREFS = {
  gender: 'neutral',
  ops: ['+', '-'],
  maxNumber: 20,
};

const sanitizeOps = (ops) => {
  const allowed = new Set(OP_OPTIONS.map((option) => option.id));
  const filtered = Array.isArray(ops) ? ops.filter((op) => allowed.has(op)) : [];
  return filtered.length ? filtered : ['+'];
};

const clampRange = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_PREFS.maxNumber;
  return Math.max(MIN_RANGE, Math.min(MAX_RANGE, Math.round(n)));
};

const normalizePrefs = (raw) => {
  const legacyPreset = DIFFICULTY_PRESETS.find((preset) => preset.id === raw?.difficulty);
  const base = legacyPreset ? { ops: legacyPreset.ops, maxNumber: legacyPreset.maxNumber } : {};
  return {
    gender: raw?.gender || DEFAULT_PREFS.gender,
    ops: sanitizeOps(raw?.ops ?? base.ops ?? DEFAULT_PREFS.ops),
    maxNumber: clampRange(raw?.maxNumber ?? base.maxNumber ?? DEFAULT_PREFS.maxNumber),
  };
};

const matchPreset = (prefs) =>
  DIFFICULTY_PRESETS.find(
    (preset) =>
      preset.maxNumber === prefs.maxNumber &&
      preset.ops.length === prefs.ops.length &&
      preset.ops.every((op) => prefs.ops.includes(op)),
  );

const formatOpsHint = (ops) => ops.map((op) => (op === '-' ? '−' : op)).join(' ');

const COLORS = [
  { id: 'red', name: 'Red', value: '#ef4444' },
  { id: 'blue', name: 'Blue', value: '#3b82f6' },
  { id: 'green', name: 'Green', value: '#22c55e' },
  { id: 'yellow', name: 'Yellow', value: '#eab308' },
  { id: 'purple', name: 'Purple', value: '#a855f7' },
  { id: 'pink', name: 'Pink', value: '#ec4899' },
  { id: 'cyan', name: 'Cyan', value: '#06b6d4' },
  { id: 'gold', name: 'Gold', value: '#fbbf24' },
  { id: 'mint', name: 'Mint', value: '#5eead4' },
  { id: 'rose', name: 'Rose', value: '#fb7185' },
];

const DECORATIONS = {
  hat: [
    { id: 'wizard', name: 'Wizard Hat' },
    { id: 'crown', name: 'Crown' },
    { id: 'tiara', name: 'Gem Tiara' },
    { id: 'cap', name: 'Cap' },
    { id: 'tophat', name: 'Top Hat' },
    { id: 'beanie', name: 'Beanie' },
    { id: 'moonhood', name: 'Moon Hood' },
  ],
  face: [
    { id: 'star_glasses', name: 'Star Glasses' },
    { id: 'heart_glasses', name: 'Heart Glasses' },
    { id: 'hero_mask', name: 'Hero Mask' },
    { id: 'gem_goggles', name: 'Gem Goggles' },
  ],
  shirt: [
    { id: 'tee', name: 'T-Shirt' },
    { id: 'armor', name: 'Armor' },
    { id: 'hoodie', name: 'Hoodie' },
    { id: 'robe', name: 'Robe' },
    { id: 'starjacket', name: 'Star Jacket' },
    { id: 'dress', name: 'Twirl Dress' },
  ],
  pants: [
    { id: 'jeans', name: 'Jeans' },
    { id: 'shorts', name: 'Shorts' },
    { id: 'armorpants', name: 'Armor Pants' },
    { id: 'skirt', name: 'Sparkle Skirt' },
  ],
  cape: [
    { id: 'cape', name: 'Cape' },
    { id: 'wings', name: 'Wings' },
    { id: 'starlight', name: 'Starlight Cape' },
    { id: 'crystalwings', name: 'Crystal Wings' },
  ],
  aura: [
    { id: 'sparkle', name: 'Sparkle Aura' },
    { id: 'rainbow', name: 'Rainbow Aura' },
    { id: 'moon', name: 'Moon Glow' },
    { id: 'heart', name: 'Heart Halo' },
  ],
  tool: [
    { id: 'wand', name: 'Magic Wand' },
    { id: 'staff', name: 'Crystal Staff' },
    { id: 'scepter', name: 'Bubble Scepter' },
    { id: 'lantern', name: 'Glow Lantern' },
  ],
};

const SLOT_INFO = {
  hat: { label: 'Hat', emoji: '🎩' },
  face: { label: 'Face', emoji: '😎' },
  shirt: { label: 'Shirt', emoji: '👕' },
  pants: { label: 'Pants', emoji: '👖' },
  cape: { label: 'Cape', emoji: '🦸' },
  aura: { label: 'Aura', emoji: '✨' },
  tool: { label: 'Tool', emoji: '🪄' },
};

const SLOT_ORDER = Object.keys(SLOT_INFO);

const RARITIES = [
  { id: 'cute', name: 'Cute', badge: 'Sweet Find', accent: '#fb7185', glow: '#fb718555' },
  { id: 'cool', name: 'Cool', badge: 'Cool Find', accent: '#38bdf8', glow: '#38bdf855' },
  { id: 'fancy', name: 'Fancy', badge: 'Fancy Find', accent: '#fbbf24', glow: '#fbbf2455' },
  { id: 'royal', name: 'Royal', badge: 'Royal Find', accent: '#a855f7', glow: '#a855f755' },
];

const MOTIFS = {
  cute: ['heart', 'dot', 'flower'],
  cool: ['bolt', 'stripe', 'gem'],
  fancy: ['star', 'ribbon', 'diamond'],
  royal: ['crown', 'moon', 'jewel'],
};

const FINISHES = {
  cute: ['soft', 'bubbly'],
  cool: ['glossy', 'electric'],
  fancy: ['sparkly', 'shimmer'],
  royal: ['glowing', 'prismatic'],
};

const ENEMIES = [
  { name: 'Slime', emoji: '🟢', hp: 3, tint: '#22c55e' },
  { name: 'Bat', emoji: '🦇', hp: 3, tint: '#6b21a8' },
  { name: 'Zombie', emoji: '🧟', hp: 4, tint: '#65a30d' },
  { name: 'Skeleton', emoji: '💀', hp: 4, tint: '#94a3b8' },
  { name: 'Ghost', emoji: '👻', hp: 4, tint: '#cbd5e1' },
  { name: 'Ogre', emoji: '👹', hp: 5, tint: '#dc2626' },
  { name: 'Dragon', emoji: '🐲', hp: 5, tint: '#f97316' },
  { name: 'Robot', emoji: '🤖', hp: 5, tint: '#64748b' },
];

const DEFAULT_SAVE = {
  inventory: [],
  equipped: {},
  nextId: 1,
};

const getColorValue = (id) => COLORS.find((color) => color.id === id)?.value || '#888';
const getColorName = (id) => COLORS.find((color) => color.id === id)?.name || 'Color';
const getRarity = (id) => RARITIES.find((rarity) => rarity.id === id) || RARITIES[0];
const getMotifName = (motif) =>
  ({
    heart: 'Heart',
    dot: 'Polka',
    flower: 'Flower',
    bolt: 'Bolt',
    stripe: 'Striped',
    gem: 'Gem',
    star: 'Star',
    ribbon: 'Ribbon',
    diamond: 'Diamond',
    crown: 'Crown',
    moon: 'Moon',
    jewel: 'Jewel',
  })[motif] || 'Magic';

const darker = (hex, amount = 0.3) => {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const weightedPick = (choices) => {
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let roll = Math.random() * total;

  for (const choice of choices) {
    roll -= choice.weight;
    if (roll <= 0) return choice.value;
  }

  return choices[choices.length - 1].value;
};

const normalizeSave = (data) => ({
  inventory: Array.isArray(data?.inventory) ? data.inventory : [],
  equipped: data?.equipped && typeof data.equipped === 'object' ? data.equipped : {},
  nextId: Number(data?.nextId || data?.next_id || 1),
});

const loadGame = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? normalizeSave(JSON.parse(saved)) : DEFAULT_SAVE;
};

const loadPrefs = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? normalizePrefs(JSON.parse(raw)) : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
};

const savePrefs = (prefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort
  }
};

const saveGame = (inventory, equipped, nextId) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      inventory,
      equipped,
      nextId,
    }),
  );
};

const getRarityForEnemy = (enemyHp) => {
  if (enemyHp >= 5) {
    return weightedPick([
      { value: 'cute', weight: 18 },
      { value: 'cool', weight: 30 },
      { value: 'fancy', weight: 36 },
      { value: 'royal', weight: 16 },
    ]);
  }

  if (enemyHp >= 4) {
    return weightedPick([
      { value: 'cute', weight: 38 },
      { value: 'cool', weight: 36 },
      { value: 'fancy', weight: 21 },
      { value: 'royal', weight: 5 },
    ]);
  }

  return weightedPick([
    { value: 'cute', weight: 62 },
    { value: 'cool', weight: 28 },
    { value: 'fancy', weight: 9 },
    { value: 'royal', weight: 1 },
  ]);
};

const getSlotForEnemy = (enemyHp) => {
  if (enemyHp >= 5) {
    return weightedPick([
      { value: 'hat', weight: 10 },
      { value: 'face', weight: 12 },
      { value: 'shirt', weight: 12 },
      { value: 'pants', weight: 8 },
      { value: 'cape', weight: 20 },
      { value: 'aura', weight: 22 },
      { value: 'tool', weight: 16 },
    ]);
  }

  if (enemyHp >= 4) {
    return weightedPick([
      { value: 'hat', weight: 18 },
      { value: 'face', weight: 16 },
      { value: 'shirt', weight: 18 },
      { value: 'pants', weight: 14 },
      { value: 'cape', weight: 16 },
      { value: 'aura', weight: 8 },
      { value: 'tool', weight: 10 },
    ]);
  }

  return weightedPick([
    { value: 'hat', weight: 26 },
    { value: 'face', weight: 18 },
    { value: 'shirt', weight: 24 },
    { value: 'pants', weight: 20 },
    { value: 'cape', weight: 8 },
    { value: 'tool', weight: 4 },
  ]);
};

const makeRewardItem = (id, defeatedEnemy) => {
  const enemyHp = defeatedEnemy?.hp || 3;
  const slot = getSlotForEnemy(enemyHp);
  const type = pickRandom(DECORATIONS[slot]);
  const color = pickRandom(COLORS);
  const trimColor = pickRandom(COLORS.filter((candidate) => candidate.id !== color.id));
  const rarity = getRarity(getRarityForEnemy(enemyHp));
  const motif = pickRandom(MOTIFS[rarity.id]);
  const finish = pickRandom(FINISHES[rarity.id]);

  return {
    id,
    slot,
    type: type.id,
    typeName: type.name,
    color: color.id,
    colorName: color.name,
    trimColor: trimColor.id,
    trimColorName: trimColor.name,
    motif,
    motifName: getMotifName(motif),
    finish,
    rarity: rarity.id,
    rarityName: rarity.name,
    sourceEnemy: defeatedEnemy?.name || 'Dungeon',
    sourceHp: enemyHp,
  };
};

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const genQuestion = (settings = DIFFICULTY_PRESETS[2]) => {
  const ops = settings.ops?.length ? settings.ops : ['+'];
  const max = Math.max(2, settings.maxNumber || 20);
  const op = ops[Math.floor(Math.random() * ops.length)];

  let a;
  let b;
  let answer;

  if (op === '+') {
    a = randInt(1, Math.max(1, max - 1));
    b = randInt(1, max - a);
    answer = a + b;
  } else if (op === '-') {
    a = randInt(2, max);
    b = randInt(1, a - 1);
    answer = a - b;
  } else if (op === '×') {
    a = randInt(2, Math.min(max, 12));
    b = randInt(2, Math.min(max, 12));
    answer = a * b;
  } else {
    b = randInt(2, Math.min(max, 12));
    answer = randInt(1, Math.min(max, 12));
    a = answer * b;
  }

  const answerCap = Math.max(answer + 6, max, 20);
  const opts = new Set([answer]);
  while (opts.size < 4) {
    const offset = randInt(-Math.min(4, answer), 4);
    const wrong = answer + offset;
    if (wrong >= 0 && wrong <= answerCap && wrong !== answer) opts.add(wrong);
  }

  return {
    a,
    b,
    op: op === '-' ? '−' : op,
    answer,
    options: [...opts].sort(() => Math.random() - 0.5),
  };
};

const Star = ({ cx, cy, size, fill = '#fde047', stroke = 'none', opacity = 1 }) => {
  const x = Number(cx);
  const y = Number(cy);
  const s = Number(size);
  return (
    <polygon
      points={`${x},${y - s} ${x + s * 0.28},${y - s * 0.28} ${x + s},${y - s * 0.22} ${x + s * 0.42},${y + s * 0.18} ${x + s * 0.6},${y + s} ${x},${y + s * 0.52} ${x - s * 0.6},${y + s} ${x - s * 0.42},${y + s * 0.18} ${x - s},${y - s * 0.22} ${x - s * 0.28},${y - s * 0.28}`}
      fill={fill}
      stroke={stroke}
      strokeWidth="2"
      opacity={opacity}
    />
  );
};

const HeartShape = ({ cx, cy, scale = 1, fill = '#fb7185', stroke = 'none', opacity = 1 }) => (
  <path
    d="M0,-5 C-7,-12 -17,-4 -10,6 L0,17 L10,6 C17,-4 7,-12 0,-5 Z"
    transform={`translate(${cx} ${cy}) scale(${scale})`}
    fill={fill}
    stroke={stroke}
    strokeWidth="2"
    opacity={opacity}
  />
);

const MotifMark = ({ motif, x, y, size = 10, fill = '#fef08a', stroke = '#1e293b', opacity = 1 }) => {
  switch (motif) {
    case 'heart':
      return <HeartShape cx={x} cy={y} scale={size / 16} fill={fill} stroke={stroke} opacity={opacity} />;
    case 'bolt':
      return <polygon points={`${x - size * 0.15},${y - size} ${x + size * 0.48},${y - size * 0.08} ${x + size * 0.08},${y - size * 0.08} ${x + size * 0.22},${y + size} ${x - size * 0.5},${y + size * 0.02} ${x - size * 0.08},${y + size * 0.02}`} fill={fill} stroke={stroke} strokeWidth="1.5" opacity={opacity} />;
    case 'stripe':
      return (
        <g fill="none" opacity={opacity} stroke={fill} strokeWidth={Math.max(1.8, size * 0.34)} strokeLinecap="round">
          <path d={`M ${x - size} ${y - size * 0.6} L ${x + size} ${y - size * 1.05}`} />
          <path d={`M ${x - size} ${y + size * 0.1} L ${x + size} ${y - size * 0.35}`} />
          <path d={`M ${x - size} ${y + size * 0.8} L ${x + size} ${y + size * 0.35}`} />
        </g>
      );
    case 'gem':
    case 'diamond':
    case 'jewel':
      return <polygon points={`${x},${y - size} ${x + size * 0.85},${y} ${x},${y + size} ${x - size * 0.85},${y}`} fill={fill} stroke={stroke} strokeWidth="1.5" opacity={opacity} />;
    case 'crown':
      return <polygon points={`${x - size},${y + size * 0.45} ${x - size},${y - size * 0.45} ${x - size * 0.36},${y + size * 0.1} ${x},${y - size * 0.7} ${x + size * 0.36},${y + size * 0.1} ${x + size},${y - size * 0.45} ${x + size},${y + size * 0.45}`} fill={fill} stroke={stroke} strokeWidth="1.5" opacity={opacity} />;
    case 'moon':
      return (
        <g opacity={opacity}>
          <circle cx={x} cy={y} r={size} fill={fill} />
          <circle cx={x + size * 0.42} cy={y - size * 0.25} r={size} fill="#312e81" />
        </g>
      );
    case 'flower':
      return (
        <g opacity={opacity}>
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse key={angle} cx={x} cy={y - size * 0.58} rx={size * 0.34} ry={size * 0.58} fill={fill} stroke={stroke} strokeWidth="1" transform={`rotate(${angle} ${x} ${y})`} />
          ))}
          <circle cx={x} cy={y} r={size * 0.32} fill="#fef08a" />
        </g>
      );
    case 'dot':
      return <circle cx={x} cy={y} r={size * 0.65} fill={fill} stroke={stroke} strokeWidth="1.5" opacity={opacity} />;
    case 'ribbon':
      return (
        <g opacity={opacity}>
          <polygon points={`${x},${y} ${x - size},${y - size * 0.62} ${x - size},${y + size * 0.62}`} fill={fill} stroke={stroke} strokeWidth="1.5" />
          <polygon points={`${x},${y} ${x + size},${y - size * 0.62} ${x + size},${y + size * 0.62}`} fill={fill} stroke={stroke} strokeWidth="1.5" />
          <circle cx={x} cy={y} r={size * 0.35} fill="#fef08a" stroke={stroke} strokeWidth="1" />
        </g>
      );
    case 'star':
    default:
      return <Star cx={x} cy={y} size={size} fill={fill} stroke={stroke} opacity={opacity} />;
  }
};

const getSlotFlairPoints = (slot) =>
  ({
    hat: [
      [112, 34, 7],
      [136, 46, 5],
    ],
    face: [
      [88, 82, 6],
      [152, 82, 6],
    ],
    shirt: [
      [120, 178, 11],
      [100, 204, 6],
      [140, 204, 6],
    ],
    pants: [
      [98, 272, 7],
      [142, 286, 7],
      [120, 322, 5],
    ],
    cape: [
      [70, 235, 8],
      [170, 268, 10],
      [120, 318, 7],
    ],
    aura: [
      [48, 100, 8],
      [196, 128, 8],
      [52, 285, 7],
      [190, 300, 9],
    ],
    tool: [
      [204, 154, 8],
      [184, 210, 5],
    ],
  })[slot] || [[120, 180, 8]];

const ItemFlair = ({ item }) => {
  if (!item) return null;
  if (['hat', 'face'].includes(item.slot)) return null;

  const rarity = getRarity(item.rarity);
  const main = getColorValue(item.trimColor || item.color);
  const base = getColorValue(item.color);
  const points = getSlotFlairPoints(item.slot);
  const opacity = item.finish === 'soft' ? 0.78 : 0.95;

  return (
    <g>
      {item.finish && item.finish !== 'soft' && ['aura', 'cape'].includes(item.slot) && (
        <ellipse cx="120" cy="190" rx="92" ry="150" fill="none" stroke={rarity.accent} strokeWidth={item.rarity === 'royal' ? 4 : 3} strokeDasharray={item.finish === 'electric' ? '4 12' : '10 14'} opacity={item.rarity === 'cute' ? 0.12 : 0.28} />
      )}
      {points.map(([x, y, size], index) => (
        <MotifMark key={`${item.id || item.type}-${index}`} motif={item.motif || 'star'} x={x} y={y} size={size} fill={index % 2 === 0 ? main : rarity.accent} stroke={darker(base, 0.55)} opacity={opacity} />
      ))}
    </g>
  );
};

const Aura = ({ type, color }) => {
  const c = getColorValue(color);
  const d = darker(c, 0.45);

  switch (type) {
    case 'sparkle':
      return (
        <g opacity="0.95">
          <ellipse cx="120" cy="190" rx="94" ry="152" fill="none" stroke={c} strokeWidth="5" strokeDasharray="12 12" opacity="0.45" />
          <Star cx="40" cy="95" size="12" fill="#fde047" />
          <Star cx="200" cy="112" size="10" fill="#f0abfc" />
          <Star cx="42" cy="265" size="9" fill="#67e8f9" />
          <Star cx="198" cy="282" size="12" fill="#fef08a" />
        </g>
      );
    case 'rainbow':
      return (
        <g fill="none" strokeLinecap="round" opacity="0.9">
          <path d="M 28 260 C 55 80 185 80 212 260" stroke="#fb7185" strokeWidth="9" />
          <path d="M 43 263 C 66 105 174 105 197 263" stroke="#fbbf24" strokeWidth="8" />
          <path d="M 58 266 C 78 130 162 130 182 266" stroke="#5eead4" strokeWidth="7" />
          <path d="M 73 270 C 88 155 152 155 167 270" stroke={c} strokeWidth="6" />
        </g>
      );
    case 'moon':
      return (
        <g opacity="0.95">
          <circle cx="190" cy="72" r="24" fill={c} />
          <circle cx="202" cy="64" r="24" fill="#312e81" />
          <circle cx="120" cy="190" r="112" fill="none" stroke={c} strokeWidth="4" strokeDasharray="6 16" opacity="0.35" />
          <Star cx="55" cy="105" size="8" fill="#fef08a" />
          <Star cx="204" cy="226" size="7" fill="#fef08a" />
        </g>
      );
    case 'heart':
      return (
        <g opacity="0.9">
          <HeartShape cx="42" cy="116" scale="0.72" fill={c} stroke={d} />
          <HeartShape cx="205" cy="136" scale="0.6" fill="#fb7185" stroke={d} />
          <HeartShape cx="40" cy="285" scale="0.52" fill="#f9a8d4" stroke={d} />
          <HeartShape cx="195" cy="288" scale="0.7" fill={c} stroke={d} />
          <ellipse cx="120" cy="190" rx="96" ry="152" fill="none" stroke={c} strokeWidth="4" strokeDasharray="10 14" opacity="0.35" />
        </g>
      );
    default:
      return null;
  }
};

const Hat = ({ type, color }) => {
  const c = getColorValue(color);
  const d = darker(c);

  switch (type) {
    case 'wizard':
      return (
        <g>
          <rect x="65" y="55" width="110" height="10" fill={d} />
          <polygon points="75,60 165,60 120,0" fill={c} stroke={d} strokeWidth="2" />
          <circle cx="105" cy="30" r="3" fill="#fde047" />
          <circle cx="130" cy="45" r="2" fill="#fde047" />
        </g>
      );
    case 'crown':
      return (
        <g>
          <polygon points="75,60 75,30 95,55 120,20 145,55 165,30 165,60" fill={c} stroke={d} strokeWidth="2" />
          <circle cx="120" cy="30" r="5" fill="#ef4444" stroke={d} strokeWidth="1" />
          <circle cx="85" cy="48" r="3" fill="#3b82f6" />
          <circle cx="155" cy="48" r="3" fill="#3b82f6" />
        </g>
      );
    case 'tiara':
      return (
        <g>
          <path d="M 82 62 L 96 42 L 112 58 L 120 30 L 128 58 L 144 42 L 158 62 Z" fill={c} stroke={d} strokeWidth="2" />
          <Star cx="120" cy="34" size="7" fill="#fef08a" stroke={d} />
          <circle cx="98" cy="50" r="4" fill="#67e8f9" />
          <circle cx="142" cy="50" r="4" fill="#f9a8d4" />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M 80 62 L 80 40 Q 80 20 120 20 Q 160 20 160 40 L 160 62 Z" fill={c} stroke={d} strokeWidth="2" />
          <rect x="140" y="50" width="50" height="10" fill={c} stroke={d} strokeWidth="2" rx="3" />
          <circle cx="120" cy="28" r="4" fill={d} />
        </g>
      );
    case 'tophat':
      return (
        <g>
          <rect x="60" y="52" width="120" height="10" fill={d} rx="2" />
          <rect x="85" y="8" width="70" height="50" fill={c} stroke={d} strokeWidth="2" rx="2" />
          <rect x="85" y="40" width="70" height="8" fill={d} />
          <Star cx="145" cy="24" size="6" fill="#fef08a" />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <path d="M 80 62 L 80 38 Q 80 22 120 22 Q 160 22 160 38 L 160 62 Z" fill={c} stroke={d} strokeWidth="2" />
          <rect x="76" y="54" width="88" height="10" fill={d} rx="2" />
          <circle cx="120" cy="16" r="8" fill={c} stroke={d} strokeWidth="2" />
        </g>
      );
    case 'moonhood':
      return (
        <g>
          <path d="M 72 68 Q 72 16 120 8 Q 168 16 168 68 L 154 68 Q 150 34 120 30 Q 90 34 86 68 Z" fill={c} stroke={d} strokeWidth="2" />
          <path d="M 134 18 A 16 16 0 1 0 148 42 A 13 13 0 1 1 134 18" fill="#fef08a" />
        </g>
      );
    default:
      return null;
  }
};

const FaceAccessory = ({ type, color }) => {
  const c = getColorValue(color);
  const d = darker(c);

  switch (type) {
    case 'star_glasses':
      return (
        <g>
          <Star cx="102" cy="98" size="17" fill={c} stroke={d} />
          <Star cx="138" cy="98" size="17" fill={c} stroke={d} />
          <rect x="114" y="96" width="12" height="4" fill={d} rx="2" />
          <circle cx="102" cy="98" r="5" fill="#1e293b" opacity="0.9" />
          <circle cx="138" cy="98" r="5" fill="#1e293b" opacity="0.9" />
        </g>
      );
    case 'heart_glasses':
      return (
        <g>
          <HeartShape cx="102" cy="95" scale="0.75" fill={c} stroke={d} />
          <HeartShape cx="138" cy="95" scale="0.75" fill={c} stroke={d} />
          <rect x="114" y="96" width="12" height="4" fill={d} rx="2" />
          <circle cx="102" cy="98" r="4" fill="#1e293b" opacity="0.9" />
          <circle cx="138" cy="98" r="4" fill="#1e293b" opacity="0.9" />
        </g>
      );
    case 'hero_mask':
      return (
        <g>
          <path d="M 86 88 Q 120 74 154 88 L 150 110 Q 120 118 90 110 Z" fill={c} stroke={d} strokeWidth="2" />
          <rect x="96" y="94" width="14" height="9" fill="#111827" rx="2" />
          <rect x="130" y="94" width="14" height="9" fill="#111827" rx="2" />
        </g>
      );
    case 'gem_goggles':
      return (
        <g>
          <rect x="88" y="86" width="30" height="24" fill={c} stroke={d} strokeWidth="2" rx="8" />
          <rect x="122" y="86" width="30" height="24" fill={c} stroke={d} strokeWidth="2" rx="8" />
          <rect x="118" y="96" width="4" height="4" fill={d} />
          <path d="M 94 92 L 112 92 L 104 106 Z" fill="#e0f2fe" opacity="0.75" />
          <path d="M 128 92 L 146 92 L 138 106 Z" fill="#e0f2fe" opacity="0.75" />
        </g>
      );
    default:
      return null;
  }
};

const Shirt = ({ type, color }) => {
  const c = getColorValue(color);
  const d = darker(c);

  switch (type) {
    case 'tee':
      return (
        <g>
          <rect x="80" y="140" width="80" height="80" fill={c} stroke={d} strokeWidth="2" />
          <rect x="40" y="140" width="40" height="40" fill={c} stroke={d} strokeWidth="2" />
          <rect x="160" y="140" width="40" height="40" fill={c} stroke={d} strokeWidth="2" />
          <rect x="104" y="138" width="32" height="10" fill={d} rx="2" />
          <Star cx="120" cy="180" size="12" fill="#fef08a" />
        </g>
      );
    case 'armor':
      return (
        <g>
          <rect x="80" y="140" width="80" height="80" fill={c} stroke={d} strokeWidth="2" />
          <rect x="40" y="140" width="40" height="50" fill={c} stroke={d} strokeWidth="2" />
          <rect x="160" y="140" width="40" height="50" fill={c} stroke={d} strokeWidth="2" />
          <rect x="88" y="148" width="64" height="64" fill="none" stroke={d} strokeWidth="2" rx="4" />
          <rect x="115" y="158" width="10" height="44" fill={d} />
          <rect x="95" y="174" width="50" height="10" fill={d} />
          <circle cx="92" cy="152" r="3" fill={d} />
          <circle cx="148" cy="152" r="3" fill={d} />
          <circle cx="92" cy="212" r="3" fill={d} />
          <circle cx="148" cy="212" r="3" fill={d} />
        </g>
      );
    case 'hoodie':
      return (
        <g>
          <path d="M 70 145 Q 75 115 120 115 Q 165 115 170 145 L 160 145 Q 155 130 120 130 Q 85 130 80 145 Z" fill={d} />
          <rect x="80" y="140" width="80" height="80" fill={c} stroke={d} strokeWidth="2" />
          <rect x="40" y="140" width="40" height="100" fill={c} stroke={d} strokeWidth="2" />
          <rect x="160" y="140" width="40" height="100" fill={c} stroke={d} strokeWidth="2" />
          <rect x="95" y="175" width="50" height="30" fill={d} rx="4" />
          <rect x="114" y="140" width="2" height="20" fill={d} />
          <rect x="124" y="140" width="2" height="20" fill={d} />
        </g>
      );
    case 'robe':
      return (
        <g>
          <polygon points="80,140 160,140 185,340 55,340" fill={c} stroke={d} strokeWidth="2" />
          <rect x="40" y="140" width="40" height="80" fill={c} stroke={d} strokeWidth="2" />
          <rect x="160" y="140" width="40" height="80" fill={c} stroke={d} strokeWidth="2" />
          <rect x="72" y="200" width="96" height="12" fill={d} rx="2" />
          <circle cx="120" cy="206" r="5" fill="#fbbf24" stroke={d} strokeWidth="1" />
          <rect x="118" y="240" width="4" height="100" fill={d} opacity="0.4" />
        </g>
      );
    case 'starjacket':
      return (
        <g>
          <rect x="80" y="140" width="80" height="88" fill={c} stroke={d} strokeWidth="2" rx="4" />
          <rect x="40" y="140" width="40" height="72" fill={c} stroke={d} strokeWidth="2" rx="4" />
          <rect x="160" y="140" width="40" height="72" fill={c} stroke={d} strokeWidth="2" rx="4" />
          <path d="M 84 144 L 112 226 M 156 144 L 128 226" stroke={d} strokeWidth="4" />
          <Star cx="120" cy="176" size="14" fill="#fef08a" stroke={d} />
          <Star cx="62" cy="165" size="7" fill="#fef08a" />
          <Star cx="178" cy="165" size="7" fill="#fef08a" />
        </g>
      );
    case 'dress':
      return (
        <g>
          <rect x="80" y="140" width="80" height="72" fill={c} stroke={d} strokeWidth="2" rx="4" />
          <rect x="42" y="140" width="38" height="48" fill={c} stroke={d} strokeWidth="2" rx="4" />
          <rect x="160" y="140" width="38" height="48" fill={c} stroke={d} strokeWidth="2" rx="4" />
          <polygon points="86,210 154,210 180,286 60,286" fill={c} stroke={d} strokeWidth="2" />
          <path d="M 74 236 Q 120 260 166 236" fill="none" stroke="#fef08a" strokeWidth="5" strokeLinecap="round" />
          <Star cx="120" cy="184" size="11" fill="#fef08a" />
        </g>
      );
    default:
      return null;
  }
};

const Pants = ({ type, color }) => {
  const c = getColorValue(color);
  const d = darker(c);

  switch (type) {
    case 'jeans':
      return (
        <g>
          <rect x="80" y="240" width="40" height="110" fill={c} stroke={d} strokeWidth="2" />
          <rect x="120" y="240" width="40" height="110" fill={c} stroke={d} strokeWidth="2" />
          <rect x="88" y="252" width="12" height="16" fill="none" stroke={d} strokeWidth="2" />
          <rect x="140" y="252" width="12" height="16" fill="none" stroke={d} strokeWidth="2" />
          <rect x="80" y="240" width="80" height="12" fill={d} />
        </g>
      );
    case 'shorts':
      return (
        <g>
          <rect x="80" y="240" width="40" height="55" fill={c} stroke={d} strokeWidth="2" />
          <rect x="120" y="240" width="40" height="55" fill={c} stroke={d} strokeWidth="2" />
          <rect x="80" y="240" width="80" height="10" fill={d} />
        </g>
      );
    case 'armorpants':
      return (
        <g>
          <rect x="80" y="240" width="40" height="110" fill={c} stroke={d} strokeWidth="2" />
          <rect x="120" y="240" width="40" height="110" fill={c} stroke={d} strokeWidth="2" />
          <rect x="80" y="270" width="80" height="4" fill={d} />
          <rect x="80" y="300" width="80" height="4" fill={d} />
          <rect x="80" y="330" width="80" height="4" fill={d} />
          <circle cx="90" cy="248" r="3" fill={d} />
          <circle cx="150" cy="248" r="3" fill={d} />
        </g>
      );
    case 'skirt':
      return (
        <g>
          <rect x="80" y="240" width="40" height="110" fill="#f0c49a" stroke="#b8875f" strokeWidth="2" />
          <rect x="120" y="240" width="40" height="110" fill="#f0c49a" stroke="#b8875f" strokeWidth="2" />
          <polygon points="76,240 164,240 178,310 62,310" fill={c} stroke={d} strokeWidth="2" />
          <path d="M 82 260 Q 120 282 158 260" fill="none" stroke="#fef08a" strokeWidth="4" strokeLinecap="round" />
          <Star cx="104" cy="284" size="7" fill="#fef08a" />
          <Star cx="138" cy="280" size="7" fill="#fef08a" />
        </g>
      );
    default:
      return null;
  }
};

const Cape = ({ type, color }) => {
  const c = getColorValue(color);
  const d = darker(c);

  switch (type) {
    case 'cape':
      return (
        <g>
          <polygon points="78,145 162,145 195,345 45,345" fill={c} stroke={d} strokeWidth="2" />
          <polygon points="78,145 162,145 120,170" fill={d} opacity="0.3" />
          <circle cx="120" cy="148" r="6" fill="#fbbf24" stroke={d} strokeWidth="1.5" />
        </g>
      );
    case 'wings':
      return (
        <g>
          <path d="M 78 145 Q 20 155 10 230 Q 30 260 55 240 Q 75 215 78 180 Z" fill={c} stroke={d} strokeWidth="2" />
          <path d="M 30 175 Q 45 180 55 195" stroke={d} strokeWidth="2" fill="none" />
          <path d="M 25 200 Q 45 205 60 215" stroke={d} strokeWidth="2" fill="none" />
          <path d="M 162 145 Q 220 155 230 230 Q 210 260 185 240 Q 165 215 162 180 Z" fill={c} stroke={d} strokeWidth="2" />
          <path d="M 210 175 Q 195 180 185 195" stroke={d} strokeWidth="2" fill="none" />
          <path d="M 215 200 Q 195 205 180 215" stroke={d} strokeWidth="2" fill="none" />
        </g>
      );
    case 'starlight':
      return (
        <g>
          <polygon points="74,142 166,142 204,348 36,348" fill={c} stroke={d} strokeWidth="2" />
          <path d="M 78 150 C 102 190 138 190 162 150" fill={d} opacity="0.25" />
          <Star cx="88" cy="222" size="10" fill="#fef08a" />
          <Star cx="154" cy="262" size="12" fill="#fef08a" />
          <Star cx="120" cy="318" size="9" fill="#f9a8d4" />
        </g>
      );
    case 'crystalwings':
      return (
        <g>
          <polygon points="78,150 16,112 50,226" fill={c} stroke={d} strokeWidth="2" opacity="0.82" />
          <polygon points="74,182 22,218 72,252" fill="#e0f2fe" stroke={d} strokeWidth="2" opacity="0.72" />
          <polygon points="162,150 224,112 190,226" fill={c} stroke={d} strokeWidth="2" opacity="0.82" />
          <polygon points="166,182 218,218 168,252" fill="#e0f2fe" stroke={d} strokeWidth="2" opacity="0.72" />
          <path d="M 42 142 L 72 184 L 48 218 M 198 142 L 168 184 L 192 218" stroke={d} strokeWidth="2" fill="none" />
        </g>
      );
    default:
      return null;
  }
};

const Tool = ({ type, color }) => {
  const c = getColorValue(color);
  const d = darker(c);

  switch (type) {
    case 'wand':
      return (
        <g>
          <path d="M 166 220 L 210 150" stroke={d} strokeWidth="9" strokeLinecap="round" />
          <path d="M 166 220 L 210 150" stroke={c} strokeWidth="5" strokeLinecap="round" />
          <Star cx="211" cy="148" size="17" fill="#fef08a" stroke={d} />
        </g>
      );
    case 'staff':
      return (
        <g>
          <path d="M 178 322 L 190 154" stroke={d} strokeWidth="10" strokeLinecap="round" />
          <path d="M 178 322 L 190 154" stroke={c} strokeWidth="5" strokeLinecap="round" />
          <polygon points="190,125 214,154 190,183 166,154" fill="#e0f2fe" stroke={d} strokeWidth="3" />
          <circle cx="190" cy="154" r="9" fill={c} />
        </g>
      );
    case 'scepter':
      return (
        <g>
          <path d="M 170 306 L 202 168" stroke={d} strokeWidth="9" strokeLinecap="round" />
          <path d="M 170 306 L 202 168" stroke={c} strokeWidth="5" strokeLinecap="round" />
          <circle cx="202" cy="158" r="18" fill="#e0f2fe" stroke={d} strokeWidth="3" />
          <circle cx="202" cy="158" r="9" fill={c} opacity="0.65" />
          <Star cx="202" cy="158" size="7" fill="#fef08a" />
        </g>
      );
    case 'lantern':
      return (
        <g>
          <path d="M 168 218 Q 190 198 210 218" fill="none" stroke={d} strokeWidth="5" />
          <rect x="174" y="216" width="30" height="46" fill={c} stroke={d} strokeWidth="3" rx="6" />
          <rect x="181" y="224" width="16" height="26" fill="#fef3c7" opacity="0.9" rx="4" />
          <path d="M 178 262 L 200 262" stroke={d} strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
};

const getItemPreviewViewBox = (slot) =>
  ({
    hat: '50 0 140 160',
    face: '58 42 124 120',
    shirt: '28 112 184 140',
    pants: '58 220 124 140',
    cape: '18 112 204 248',
    aura: '0 18 240 330',
    tool: '118 108 116 230',
  })[slot] || '0 0 240 360';

const StarterShirt = () => (
  <g>
    <rect x="80" y="140" width="80" height="88" fill="#93c5fd" stroke="#2563eb" strokeWidth="2" rx="3" />
    <rect x="40" y="140" width="40" height="48" fill="#93c5fd" stroke="#2563eb" strokeWidth="2" rx="3" />
    <rect x="160" y="140" width="40" height="48" fill="#93c5fd" stroke="#2563eb" strokeWidth="2" rx="3" />
    <Star cx="120" cy="180" size="10" fill="#fef08a" stroke="#2563eb" />
  </g>
);

const StarterPants = () => (
  <g>
    <rect x="80" y="240" width="40" height="92" fill="#facc15" stroke="#a16207" strokeWidth="2" />
    <rect x="120" y="240" width="40" height="92" fill="#facc15" stroke="#a16207" strokeWidth="2" />
    <rect x="80" y="240" width="80" height="10" fill="#a16207" />
  </g>
);

const HairStyle = ({ gender }) => {
  const hair = '#5b3a1e';
  const hairD = '#3d2612';
  if (gender === 'girl') {
    return (
      <g>
        <path d="M 68 70 Q 68 50 120 50 Q 172 50 172 70 L 172 110 Q 162 78 120 78 Q 78 78 68 110 Z" fill={hair} stroke={hairD} strokeWidth="2" />
        <path d="M 60 110 Q 58 150 66 190 L 80 190 L 80 125 Q 74 118 60 110 Z" fill={hair} stroke={hairD} strokeWidth="2" />
        <path d="M 180 110 Q 182 150 174 190 L 160 190 L 160 125 Q 166 118 180 110 Z" fill={hair} stroke={hairD} strokeWidth="2" />
        <circle cx="94" cy="56" r="5" fill="#fb7185" stroke={hairD} strokeWidth="1.5" />
      </g>
    );
  }
  if (gender === 'boy') {
    return (
      <g>
        <path d="M 76 74 Q 78 54 120 52 Q 162 54 164 74 L 164 88 Q 156 74 120 74 Q 84 74 76 88 Z" fill={hair} stroke={hairD} strokeWidth="2" />
      </g>
    );
  }
  return null;
};

const Avatar = ({ equipped = {}, gender = 'neutral', animClass = '', expression = 'normal', viewBox = '0 0 240 360' }) => {
  const skin = '#f0c49a';
  const skinD = '#b8875f';

  return (
    <svg viewBox={viewBox} className={`w-full h-full ${animClass}`} style={{ imageRendering: 'auto' }}>
      {equipped.aura && <Aura type={equipped.aura.type} color={equipped.aura.color} />}
      {equipped.cape && <Cape type={equipped.cape.type} color={equipped.cape.color} />}

      <rect x="80" y="240" width="40" height="110" fill={skin} stroke={skinD} strokeWidth="2" />
      <rect x="120" y="240" width="40" height="110" fill={skin} stroke={skinD} strokeWidth="2" />

      {equipped.pants ? <Pants type={equipped.pants.type} color={equipped.pants.color} /> : <StarterPants />}

      <rect x="80" y="140" width="80" height="100" fill={skin} stroke={skinD} strokeWidth="2" />
      <rect x="40" y="140" width="40" height="100" fill={skin} stroke={skinD} strokeWidth="2" />
      <rect x="160" y="140" width="40" height="100" fill={skin} stroke={skinD} strokeWidth="2" />

      {equipped.shirt ? <Shirt type={equipped.shirt.type} color={equipped.shirt.color} /> : <StarterShirt />}
      {equipped.tool && <Tool type={equipped.tool.type} color={equipped.tool.color} />}

      <rect x="80" y="60" width="80" height="80" fill={skin} stroke={skinD} strokeWidth="2" />
      {expression === 'hurt' ? (
        <>
          <path d="M 96 90 L 108 102 M 108 90 L 96 102" stroke="#1e293b" strokeWidth="3" />
          <path d="M 132 90 L 144 102 M 144 90 L 132 102" stroke="#1e293b" strokeWidth="3" />
        </>
      ) : expression === 'happy' ? (
        <>
          <path d="M 96 96 Q 102 90 108 96" stroke="#1e293b" strokeWidth="3" fill="none" />
          <path d="M 132 96 Q 138 90 144 96" stroke="#1e293b" strokeWidth="3" fill="none" />
        </>
      ) : (
        <>
          <rect x="96" y="92" width="12" height="12" fill="#1e293b" />
          <rect x="132" y="92" width="12" height="12" fill="#1e293b" />
          <rect x="100" y="96" width="4" height="4" fill="white" />
          <rect x="136" y="96" width="4" height="4" fill="white" />
        </>
      )}

      {expression === 'happy' ? (
        <path d="M 104 120 Q 120 130 136 120" stroke="#8b4513" strokeWidth="3" fill="none" />
      ) : expression === 'hurt' ? (
        <path d="M 104 124 Q 120 115 136 124" stroke="#8b4513" strokeWidth="3" fill="none" />
      ) : (
        <rect x="108" y="120" width="24" height="4" fill="#8b4513" />
      )}

      <circle cx="90" cy="115" r="5" fill="#ff6b9d" opacity="0.3" />
      <circle cx="150" cy="115" r="5" fill="#ff6b9d" opacity="0.3" />

      <HairStyle gender={gender} />

      {equipped.face && <FaceAccessory type={equipped.face.type} color={equipped.face.color} />}
      {equipped.hat && <Hat type={equipped.hat.type} color={equipped.hat.color} />}
      {Object.values(equipped).map((item) => (
        <ItemFlair key={`${item.slot}-${item.id || item.type}`} item={item} />
      ))}
    </svg>
  );
};

const RarityBadge = ({ rarity, className = '' }) => (
  <div
    className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-950 ${className}`}
    style={{ background: rarity.accent }}
  >
    {rarity.name}
  </div>
);

const ItemAvatar = ({ item, className = 'w-40 h-60' }) => (
  <div className={className}>
    <svg viewBox={getItemPreviewViewBox(item.slot)} className="h-full w-full" style={{ imageRendering: 'auto' }}>
      <ItemOnlyPreview item={item} />
    </svg>
  </div>
);

const ItemOnlyPreview = ({ item }) => {
  const skin = '#f0c49a';
  const skinD = '#b8875f';

  switch (item.slot) {
    case 'hat':
      return (
        <g>
          <rect x="80" y="60" width="80" height="80" fill={skin} stroke={skinD} strokeWidth="2" opacity="0.35" />
          <path d="M 96 96 Q 102 90 108 96" stroke="#1e293b" strokeWidth="3" fill="none" opacity="0.55" />
          <path d="M 132 96 Q 138 90 144 96" stroke="#1e293b" strokeWidth="3" fill="none" opacity="0.55" />
          <Hat type={item.type} color={item.color} />
        </g>
      );
    case 'face':
      return (
        <g>
          <rect x="80" y="60" width="80" height="80" fill={skin} stroke={skinD} strokeWidth="2" opacity="0.45" />
          <FaceAccessory type={item.type} color={item.color} />
        </g>
      );
    case 'shirt':
      return (
        <g>
          <rect x="80" y="60" width="80" height="80" fill={skin} opacity="0.2" />
          <rect x="80" y="140" width="80" height="100" fill={skin} stroke={skinD} strokeWidth="2" opacity="0.35" />
          <rect x="40" y="140" width="40" height="100" fill={skin} stroke={skinD} strokeWidth="2" opacity="0.35" />
          <rect x="160" y="140" width="40" height="100" fill={skin} stroke={skinD} strokeWidth="2" opacity="0.35" />
          <Shirt type={item.type} color={item.color} />
          <ItemFlair item={item} />
        </g>
      );
    case 'pants':
      return (
        <g>
          <rect x="80" y="240" width="40" height="110" fill={skin} stroke={skinD} strokeWidth="2" opacity="0.35" />
          <rect x="120" y="240" width="40" height="110" fill={skin} stroke={skinD} strokeWidth="2" opacity="0.35" />
          <Pants type={item.type} color={item.color} />
          <ItemFlair item={item} />
        </g>
      );
    case 'cape':
      return (
        <g>
          <Cape type={item.type} color={item.color} />
          <ItemFlair item={item} />
        </g>
      );
    case 'aura':
      return (
        <g>
          <Aura type={item.type} color={item.color} />
          <ItemFlair item={item} />
          <rect x="96" y="108" width="48" height="60" fill={skin} stroke={skinD} strokeWidth="2" opacity="0.2" />
        </g>
      );
    case 'tool':
      return (
        <g>
          <Tool type={item.type} color={item.color} />
          <ItemFlair item={item} />
        </g>
      );
    default:
      return null;
  }
};

const Heart = ({ filled }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6 sm:h-7 sm:w-7">
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill={filled ? '#ef4444' : '#e5e7eb'}
      stroke={filled ? '#b91c1c' : '#9ca3af'}
      strokeWidth="1"
    />
  </svg>
);

export default function MathDungeon() {
  const [loaded, setLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [user, setUser] = useState(null);
  const [authMessage, setAuthMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? 'local' : 'setup');
  const [syncMessage, setSyncMessage] = useState(
    isSupabaseConfigured ? 'Guest save on this device.' : 'Add the Supabase anon key to enable cloud save.',
  );

  const [mode, setMode] = useState('home');
  const [inventory, setInventory] = useState([]);
  const [equipped, setEquipped] = useState({});
  const [nextId, setNextId] = useState(1);

  const [enemy, setEnemy] = useState(null);
  const [enemyMaxHp, setEnemyMaxHp] = useState(0);
  const [playerHp, setPlayerHp] = useState(MAX_PLAYER_HP);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [playerAnim, setPlayerAnim] = useState('');
  const [enemyAnim, setEnemyAnim] = useState('');
  const [floatingText, setFloatingText] = useState(null);

  const [newItem, setNewItem] = useState(null);
  const [boxOpened, setBoxOpened] = useState(false);

  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [showSettings, setShowSettings] = useState(false);
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const updatePrefs = useCallback(
    (patch) => {
      setPrefs((prev) => {
        const next = normalizePrefs({ ...prev, ...patch });
        if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
        savePrefs(next);
        if (supabase && user) {
          supabase
            .from('game_saves')
            .upsert(
              {
                user_id: user.id,
                inventory,
                equipped,
                next_id: nextId,
                prefs: next,
              },
              { onConflict: 'user_id' },
            )
            .then(({ error }) => {
              if (error) {
                setSyncStatus('error');
                setSyncMessage(error.message);
              }
            });
        }
        return next;
      });
    },
    [user, inventory, equipped, nextId],
  );

  useEffect(() => {
    try {
      const data = loadGame();
      setInventory(data.inventory);
      setEquipped(data.equipped);
      setNextId(data.nextId);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const save = useCallback(
    (inv, eq, id, prefsToSave) => {
      try {
        saveGame(inv, eq, id);
      } catch {
        // Saving is best-effort; the game still works without persistence.
      }

      if (!supabase || !user) {
        setSyncStatus(isSupabaseConfigured ? 'local' : 'setup');
        setSyncMessage(isSupabaseConfigured ? 'Guest save on this device.' : 'Add the Supabase anon key to enable cloud save.');
        return;
      }

      setSyncStatus('syncing');
      setSyncMessage('Saving...');
      supabase
        .from('game_saves')
        .upsert(
          {
            user_id: user.id,
            inventory: inv,
            equipped: eq,
            next_id: id,
            prefs: prefsToSave,
          },
          { onConflict: 'user_id' },
        )
        .then(({ error }) => {
          if (error) {
            setSyncStatus('error');
            setSyncMessage(error.message);
            return;
          }
          setSyncStatus('saved');
          setSyncMessage('Cloud save ready.');
        });
    },
    [user],
  );

  useEffect(() => {
    if (!loaded || !authReady || !supabase) return undefined;

    if (!user) {
      setSyncStatus('local');
      setSyncMessage('Guest save on this device.');
      return undefined;
    }

    let cancelled = false;

    const syncFromCloud = async () => {
      setSyncStatus('syncing');
      setSyncMessage('Loading cloud save...');

      const { data, error } = await supabase
        .from('game_saves')
        .select('inventory,equipped,next_id,prefs')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setSyncStatus('error');
        setSyncMessage(error.message);
        return;
      }

      if (data) {
        const cloudSave = normalizeSave(data);
        const cloudPrefsRaw = data.prefs && Object.keys(data.prefs).length > 0 ? normalizePrefs(data.prefs) : null;
        const localHasItems = inventory.length > 0;
        const cloudHasItems = cloudSave.inventory.length > 0;

        if (localHasItems && cloudHasItems) {
          const sameInventory =
            inventory.length === cloudSave.inventory.length &&
            JSON.stringify([...inventory].sort((a, b) => a.id - b.id)) ===
              JSON.stringify([...cloudSave.inventory].sort((a, b) => a.id - b.id));
          const sameEquipped = JSON.stringify(equipped) === JSON.stringify(cloudSave.equipped);

          if (sameInventory && sameEquipped) {
            if (cloudPrefsRaw) {
              setPrefs(cloudPrefsRaw);
              savePrefs(cloudPrefsRaw);
            }
            setSyncStatus('saved');
            setSyncMessage('Cloud save in sync.');
            return;
          }

          setConflict({
            local: { inventory, equipped, nextId, prefs },
            cloud: { ...cloudSave, prefs: cloudPrefsRaw || prefs },
          });
          setSyncStatus('conflict');
          setSyncMessage('Two saves found. Pick which one to keep.');
          return;
        }

        if (cloudHasItems) {
          setInventory(cloudSave.inventory);
          setEquipped(cloudSave.equipped);
          setNextId(cloudSave.nextId);
          saveGame(cloudSave.inventory, cloudSave.equipped, cloudSave.nextId);
          if (cloudPrefsRaw) {
            setPrefs(cloudPrefsRaw);
            savePrefs(cloudPrefsRaw);
          }
          setSyncStatus('saved');
          setSyncMessage('Cloud save loaded.');
          return;
        }

        if (localHasItems) {
          const { error: pushError } = await supabase
            .from('game_saves')
            .upsert(
              {
                user_id: user.id,
                inventory,
                equipped,
                next_id: nextId,
                prefs,
              },
              { onConflict: 'user_id' },
            );
          if (cancelled) return;
          if (pushError) {
            setSyncStatus('error');
            setSyncMessage(pushError.message);
            return;
          }
          setSyncStatus('saved');
          setSyncMessage('Guest save copied to cloud.');
          return;
        }

        if (cloudPrefsRaw) {
          setPrefs(cloudPrefsRaw);
          savePrefs(cloudPrefsRaw);
        }
        setSyncStatus('saved');
        setSyncMessage('Cloud save ready.');
        return;
      }

      const localSave = normalizeSave({ inventory, equipped, nextId });
      const { error: upsertError } = await supabase.from('game_saves').upsert(
        {
          user_id: user.id,
          inventory: localSave.inventory,
          equipped: localSave.equipped,
          next_id: localSave.nextId,
          prefs,
        },
        { onConflict: 'user_id' },
      );

      if (cancelled) return;

      if (upsertError) {
        setSyncStatus('error');
        setSyncMessage(upsertError.message);
        return;
      }

      setSyncStatus('saved');
      setSyncMessage('Local save copied to cloud.');
    };

    syncFromCloud();

    return () => {
      cancelled = true;
    };
  }, [loaded, authReady, user?.id]);

  const resolveConflict = useCallback(
    (choice) => {
      if (!conflict) return;
      const { local, cloud } = conflict;

      let resolvedInv;
      let resolvedEq;
      let resolvedNextId;
      let resolvedPrefs;

      if (choice === 'local') {
        resolvedInv = local.inventory;
        resolvedEq = local.equipped;
        resolvedNextId = local.nextId;
        resolvedPrefs = local.prefs;
      } else if (choice === 'cloud') {
        resolvedInv = cloud.inventory;
        resolvedEq = cloud.equipped;
        resolvedNextId = cloud.nextId;
        resolvedPrefs = cloud.prefs;
      } else {
        const sig = (item) =>
          `${item.slot}|${item.type}|${item.color}|${item.trimColor || ''}|${item.motif}|${item.finish}|${item.rarity}`;
        const seen = new Set();
        const merged = [];
        let id = Math.max(local.nextId, cloud.nextId);
        for (const item of [...cloud.inventory, ...local.inventory]) {
          const key = sig(item);
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push({ ...item, id: id++ });
        }
        const reEquip = (eq) => {
          const out = {};
          for (const [slot, item] of Object.entries(eq || {})) {
            const found = merged.find((m) => sig(m) === sig(item));
            if (found) out[slot] = found;
          }
          return out;
        };
        resolvedInv = merged;
        resolvedEq = { ...reEquip(cloud.equipped), ...reEquip(local.equipped) };
        resolvedNextId = id;
        resolvedPrefs = local.prefs;
      }

      setInventory(resolvedInv);
      setEquipped(resolvedEq);
      setNextId(resolvedNextId);
      setPrefs(resolvedPrefs);
      savePrefs(resolvedPrefs);
      saveGame(resolvedInv, resolvedEq, resolvedNextId);
      save(resolvedInv, resolvedEq, resolvedNextId, resolvedPrefs);
      setConflict(null);
    },
    [conflict, save],
  );

  const requestLoginCode = useCallback(async (email) => {
    if (!supabase) {
      setAuthMessage('Cloud save needs Supabase setup first.');
      return { ok: false };
    }

    const emailRedirectTo = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo },
    });

    if (error) {
      setAuthMessage(error.message);
      return { ok: false };
    }

    setAuthMessage('Check your email for the 6-digit code.');
    return { ok: true };
  }, []);

  const verifyLoginCode = useCallback(async (email, token) => {
    if (!supabase) return { ok: false };

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: 'email',
    });

    if (error) {
      setAuthMessage(error.message);
      return { ok: false };
    }

    setAuthMessage('');
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setInventory([]);
    setEquipped({});
    setNextId(1);
    setPrefs(DEFAULT_PREFS);
    setConflict(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PREFS_KEY);
    } catch {
      // best-effort
    }
    setAuthMessage('Signed out. Your account data stays in the cloud.');
    setSyncStatus('local');
    setSyncMessage('Sign in to load your save.');
  }, []);

  const startBattle = () => {
    const e = pickRandom(ENEMIES);
    setEnemy({ ...e });
    setEnemyMaxHp(e.hp);
    setPlayerHp(MAX_PLAYER_HP);
    setQuestion(genQuestion(prefs));
    setSelected(null);
    setFeedback(null);
    setMode('battle');
  };

  const answerQuestion = (value) => {
    if (feedback !== null || !question || !enemy) return;

    setSelected(value);
    const correct = value === question.answer;

    if (correct) {
      setFeedback('correct');
      setPlayerAnim('attack');
      setTimeout(() => {
        setEnemyAnim('hurt');
        setFloatingText({ text: '-1', color: '#ef4444', on: 'enemy' });
        const newEnemyHp = enemy.hp - 1;
        setEnemy((e) => ({ ...e, hp: newEnemyHp }));

        setTimeout(() => {
          setFloatingText(null);
          setEnemyAnim('');
          setPlayerAnim('');

          if (newEnemyHp <= 0) {
            setTimeout(() => {
              setNewItem(makeRewardItem(nextId, enemy));
              setNextId((n) => n + 1);
              setBoxOpened(false);
              setMode('reward');
            }, 400);
          } else {
            setQuestion(genQuestion(prefs));
            setSelected(null);
            setFeedback(null);
          }
        }, 700);
      }, 300);
    } else {
      setFeedback('wrong');
      setEnemyAnim('attack');
      setTimeout(() => {
        setPlayerAnim('hurt');
        setFloatingText({ text: '-1', color: '#ef4444', on: 'player' });
        const newHp = playerHp - 1;
        setPlayerHp(newHp);

        setTimeout(() => {
          setFloatingText(null);
          setPlayerAnim('');
          setEnemyAnim('');

          if (newHp <= 0) {
            setTimeout(() => setMode('gameover'), 400);
          } else {
            setQuestion(genQuestion(prefs));
            setSelected(null);
            setFeedback(null);
          }
        }, 700);
      }, 300);
    }
  };

  const claimReward = () => {
    if (!newItem) return;

    const updatedInventory = [...inventory, newItem];
    let updatedEquipped = equipped;

    if (!equipped[newItem.slot]) {
      updatedEquipped = { ...equipped, [newItem.slot]: newItem };
      setEquipped(updatedEquipped);
    }

    const updatedNextId = Math.max(nextId, newItem.id + 1);
    setInventory(updatedInventory);
    setNextId(updatedNextId);
    save(updatedInventory, updatedEquipped, updatedNextId, prefs);
    setNewItem(null);
    setMode('home');
  };

  const equipItem = (item) => {
    const current = equipped[item.slot];
    const updated =
      current && current.id === item.id
        ? (() => {
            const { [item.slot]: removed, ...rest } = equipped;
            void removed;
            return rest;
          })()
        : { ...equipped, [item.slot]: item };

    setEquipped(updated);
    save(inventory, updated, nextId, prefs);
  };

  const authPanel = (
    <AuthPanel
      user={user}
      configured={isSupabaseConfigured}
      authMessage={authMessage}
      syncStatus={syncStatus}
      syncMessage={syncMessage}
      onRequestCode={requestLoginCode}
      onVerifyCode={verifyLoginCode}
      onSignOut={signOut}
    />
  );

  if (!loaded) {
    return (
      <div
        className="flex min-h-[100dvh] w-full items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #312e81 0%, #4c1d95 50%, #831843 100%)' }}
      >
        <div className="text-2xl text-white title-font">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <GameStyles />

      <div
        className="relative min-h-[100dvh] w-full overflow-x-hidden body-font"
        style={{
          background:
            mode === 'battle'
              ? 'linear-gradient(180deg, #1e1b4b 0%, #4c1d95 58%, #18181b 100%)'
              : mode === 'gameover'
                ? 'linear-gradient(180deg, #7f1d1d 0%, #450a0a 100%)'
                : 'linear-gradient(160deg, #312e81 0%, #7c3aed 47%, #db2777 100%)',
        }}
      >
        <FancyBackdrop mode={mode} />
        {mode === 'battle' && <DungeonBg />}

        {mode === 'home' && (
          <HomeScreen
            equipped={equipped}
            prefs={prefs}
            inventoryCount={inventory.length}
            authPanel={authPanel}
            onBattle={startBattle}
            onInventory={() => setMode('inventory')}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}

        {mode === 'battle' && enemy && question && (
          <BattleScreen
            enemy={enemy}
            enemyMaxHp={enemyMaxHp}
            playerHp={playerHp}
            question={question}
            selected={selected}
            feedback={feedback}
            equipped={equipped}
            gender={prefs.gender}
            playerAnim={playerAnim}
            enemyAnim={enemyAnim}
            floatingText={floatingText}
            onAnswer={answerQuestion}
          />
        )}

        {mode === 'reward' && newItem && (
          <RewardScreen item={newItem} opened={boxOpened} onOpen={() => setBoxOpened(true)} onClaim={claimReward} />
        )}

        {mode === 'inventory' && (
          <InventoryScreen inventory={inventory} equipped={equipped} gender={prefs.gender} onEquip={equipItem} onBack={() => setMode('home')} authPanel={authPanel} />
        )}

        {mode === 'gameover' && <GameOverScreen onRetry={startBattle} onHome={() => setMode('home')} />}

        {showSettings && (
          <SettingsModal prefs={prefs} onChange={updatePrefs} onClose={() => setShowSettings(false)} />
        )}

        {conflict && <SaveConflictModal conflict={conflict} onResolve={resolveConflict} />}
      </div>
    </>
  );
}

const pickerTileStyle = (active) => ({
  background: active ? 'rgba(250, 204, 21, 0.18)' : 'rgba(255,255,255,0.05)',
  borderColor: active ? '#facc15' : 'rgba(255,255,255,0.15)',
});

const GENDER_OPTIONS = [
  { id: 'neutral', label: 'Default', emoji: '🧑' },
  { id: 'boy', label: 'Boy', emoji: '👦' },
  { id: 'girl', label: 'Girl', emoji: '👧' },
];

const SettingsModal = ({ prefs, onChange, onClose }) => {
  const activePreset = matchPreset(prefs);

  const toggleOp = (opId) => {
    const has = prefs.ops.includes(opId);
    const next = has ? prefs.ops.filter((op) => op !== opId) : [...prefs.ops, opId];
    if (!next.length) return;
    onChange({ ops: next });
  };

  const applyPreset = (preset) => {
    onChange({ ops: [...preset.ops], maxNumber: preset.maxNumber });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border-2 border-white/20 bg-slate-900 p-5 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="title-font text-2xl">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold active:scale-95"
          >
            ✕
          </button>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-sm font-bold text-white/80">Hero look</div>
          <div className="grid grid-cols-3 gap-2">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => onChange({ gender: option.id })}
                className="flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all active:scale-95"
                style={pickerTileStyle(prefs.gender === option.id)}
              >
                <span className="text-2xl">{option.emoji}</span>
                <span className="text-xs font-bold">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-sm font-bold text-white/80">Quick preset</div>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className="rounded-full border-2 px-3 py-1 text-xs font-bold transition-all active:scale-95"
                style={pickerTileStyle(activePreset?.id === preset.id)}
              >
                {preset.name}
              </button>
            ))}
            <span
              className="rounded-full border-2 px-3 py-1 text-xs font-bold"
              style={pickerTileStyle(!activePreset)}
            >
              Custom
            </span>
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-sm font-bold text-white/80">
            <span>Operations</span>
            <span className="text-xs text-white/50">pick at least one</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {OP_OPTIONS.map((option) => {
              const active = prefs.ops.includes(option.id);
              const onlyThisActive = active && prefs.ops.length === 1;
              return (
                <button
                  key={option.id}
                  onClick={() => toggleOp(option.id)}
                  disabled={onlyThisActive}
                  className="flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all active:scale-95 disabled:opacity-70"
                  style={pickerTileStyle(active)}
                >
                  <span className="text-2xl font-bold">{option.label}</span>
                  <span className="text-[11px] font-bold opacity-80">{option.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-2">
          <div className="mb-2 flex items-center justify-between text-sm font-bold text-white/80">
            <span>Number range</span>
            <span className="font-mono text-yellow-200">1 – {prefs.maxNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={MIN_RANGE}
              max={MAX_RANGE}
              value={prefs.maxNumber}
              onChange={(event) => onChange({ maxNumber: clampRange(event.target.value) })}
              className="flex-1 accent-yellow-300"
            />
            <input
              type="number"
              min={MIN_RANGE}
              max={MAX_RANGE}
              value={prefs.maxNumber}
              onChange={(event) => onChange({ maxNumber: clampRange(event.target.value) })}
              className="w-20 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-right text-sm font-bold text-white outline-none focus:border-yellow-300"
            />
          </div>
          <div className="mt-1 text-[11px] text-white/50">
            Between {MIN_RANGE} and {MAX_RANGE}. Multiplication and division use up to 12 regardless.
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-white/45">v{APP_VERSION}</p>
      </div>
    </div>
  );
};

const SaveConflictModal = ({ conflict, onResolve }) => {
  const summary = (side) => ({
    items: side.inventory.length,
    equipped: Object.keys(side.equipped || {}).length,
  });
  const local = summary(conflict.local);
  const cloud = summary(conflict.cloud);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border-2 border-white/20 bg-slate-900 p-5 text-white shadow-2xl">
        <h2 className="title-font mb-1 text-2xl text-yellow-200">Two saves found</h2>
        <p className="mb-4 text-sm text-white/70">
          You have items on this device <em>and</em> on this account. Pick which save to keep — the other will be overwritten unless you combine them.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-sky-400/40 bg-sky-500/10 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-sky-200">This device</div>
            <div className="mt-2 text-3xl font-bold">{local.items}</div>
            <div className="text-xs text-white/60">items</div>
            <div className="mt-1 text-[11px] text-white/50">{local.equipped} equipped</div>
          </div>
          <div className="rounded-2xl border-2 border-purple-400/40 bg-purple-500/10 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-purple-200">Cloud account</div>
            <div className="mt-2 text-3xl font-bold">{cloud.items}</div>
            <div className="text-xs text-white/60">items</div>
            <div className="mt-1 text-[11px] text-white/50">{cloud.equipped} equipped</div>
          </div>
        </div>

        <div className="grid gap-2">
          <button
            onClick={() => onResolve('combine')}
            className="chunky-btn rounded-2xl py-3 text-base text-white title-font"
            style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}
          >
            ✨ Combine both saves
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onResolve('local')}
              className="chunky-btn rounded-xl py-2 text-sm text-white title-font"
              style={{ background: 'linear-gradient(135deg, #0284c7, #0ea5e9)' }}
            >
              Keep this device
            </button>
            <button
              onClick={() => onResolve('cloud')}
              className="chunky-btn rounded-xl py-2 text-sm text-white title-font"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              Keep cloud
            </button>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-white/45">
          Combine de-duplicates by item type, color, motif, and finish, then re-numbers IDs.
        </p>
      </div>
    </div>
  );
};

const GameStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Press+Start+2P&family=Baloo+2:wght@700;800&display=swap');

    @keyframes pop-in { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
    @keyframes shake-hard { 0%,100%{transform:translate(0,0);} 10%{transform:translate(-8px,2px);} 20%{transform:translate(7px,-2px);} 30%{transform:translate(-6px,3px);} 40%{transform:translate(6px,-3px);} 50%{transform:translate(-5px,2px);} 60%{transform:translate(5px,-2px);} 70%{transform:translate(-3px,1px);} 80%{transform:translate(3px,-1px);} 90%{transform:translate(-1px,0);} }
    @keyframes lunge-right { 0%,100%{transform:translateX(0);} 50%{transform:translateX(30px);} }
    @keyframes lunge-left { 0%,100%{transform:translateX(0);} 50%{transform:translateX(-30px);} }
    @keyframes flash-red { 0%,100%{filter:none;} 50%{filter:brightness(1.3) hue-rotate(-30deg) saturate(2);} }
    @keyframes float-up { 0%{transform:translateY(0);opacity:1;} 100%{transform:translateY(-50px);opacity:0;} }
    @keyframes bounce-bob { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-10px);} }
    @keyframes wiggle { 0%,100%{transform:rotate(0);} 25%{transform:rotate(-4deg);} 75%{transform:rotate(4deg);} }
    @keyframes confetti-fall { 0%{transform:translateY(-20px) rotate(0);opacity:1;} 100%{transform:translateY(100vh) rotate(720deg);opacity:0;} }
    @keyframes sparkle { 0%,100%{transform:scale(0);opacity:0;} 50%{transform:scale(1);opacity:1;} }
    @keyframes box-shake { 0%,100%{transform:rotate(0);} 20%{transform:rotate(-8deg);} 40%{transform:rotate(8deg);} 60%{transform:rotate(-6deg);} 80%{transform:rotate(6deg);} }
    @keyframes drift { 0%,100%{transform:translate3d(0,0,0) rotate(0deg);} 50%{transform:translate3d(8px,-12px,0) rotate(8deg);} }
    @keyframes pulse-tile { 0%,100%{opacity:0.42;} 50%{opacity:0.85;} }

    .avatar-attack { animation: lunge-right 0.35s ease-in-out; }
    .avatar-hurt { animation: shake-hard 0.5s, flash-red 0.5s; }
    .enemy-attack { animation: lunge-left 0.35s ease-in-out; }
    .enemy-hurt { animation: shake-hard 0.5s, flash-red 0.5s; }

    .chunky-btn { transition: all 0.12s ease; box-shadow: 0 6px 0 rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15); }
    .chunky-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 0 rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.2); }
    .chunky-btn:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 2px 0 rgba(0,0,0,0.25); }
    .chunky-btn:disabled { opacity: 0.7; cursor: not-allowed; }

    .pixel-font { font-family: 'Press Start 2P', monospace; }
    .title-font { font-family: 'Baloo 2', sans-serif; font-weight: 800; }
    .body-font { font-family: 'Fredoka', sans-serif; }
  `}</style>
);

const FancyBackdrop = ({ mode }) => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 6 + Math.random() * 13,
        delay: Math.random() * 4,
        color: ['#fef08a', '#f9a8d4', '#67e8f9', '#c4b5fd', '#86efac'][i % 5],
        shape: i % 3,
      })),
    [],
  );

  if (mode === 'gameover') return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.08) 25%, transparent 25%)',
          backgroundSize: '46px 46px',
        }}
      />
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute"
          style={{
            left: `${piece.left}%`,
            top: `${piece.top}%`,
            width: piece.size,
            height: piece.size,
            opacity: mode === 'battle' ? 0.22 : 0.55,
            animation: `drift ${3 + (piece.id % 4)}s ease-in-out ${piece.delay}s infinite`,
          }}
        >
          {piece.shape === 0 ? (
            <div className="h-full w-full rotate-45 rounded-[3px]" style={{ background: piece.color }} />
          ) : piece.shape === 1 ? (
            <div className="h-full w-full rounded-full border-2" style={{ borderColor: piece.color }} />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: piece.color,
                clipPath: 'polygon(50% 0%, 62% 35%, 100% 35%, 68% 56%, 80% 100%, 50% 72%, 20% 100%, 32% 56%, 0% 35%, 38% 35%)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

const DungeonBg = () => (
  <div
    className="pointer-events-none absolute inset-0 opacity-20"
    style={{
      backgroundImage: `repeating-linear-gradient(0deg, transparent 0 40px, rgba(255,255,255,0.08) 40px 42px),
                       repeating-linear-gradient(90deg, transparent 0 60px, rgba(255,255,255,0.08) 60px 62px)`,
    }}
  />
);

const AuthPanel = ({ configured, user, authMessage, syncStatus, syncMessage, onRequestCode, onVerifyCode, onSignOut }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);

  const statusColor =
    syncStatus === 'saved' ? '#22c55e' : syncStatus === 'syncing' ? '#fbbf24' : syncStatus === 'error' ? '#ef4444' : '#94a3b8';

  const submitEmail = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const result = await onRequestCode(email.trim());
    setBusy(false);
    if (result?.ok) setStep('code');
  };

  const submitCode = async (event) => {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const result = await onVerifyCode(email.trim(), code.trim());
    setBusy(false);
    if (result?.ok) {
      setCode('');
      setStep('email');
    }
  };

  const resetToEmail = () => {
    setCode('');
    setStep('email');
  };

  if (!configured) {
    return (
      <div className="w-full rounded-2xl border border-white/20 bg-black/25 p-3 text-white shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          Cloud Save
        </div>
        <p className="mt-1 text-xs leading-snug text-white/70">Guest play works now. Add the Supabase anon key to save across devices.</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="w-full rounded-2xl border border-white/20 bg-black/25 p-3 text-white shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor }} />
              Cloud Save
            </div>
            <div className="truncate text-xs text-white/70">{user.email}</div>
          </div>
          <button onClick={onSignOut} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white active:scale-95">
            Sign out
          </button>
        </div>
        <p className="mt-2 text-xs leading-snug text-white/70">{authMessage || syncMessage}</p>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={submitCode} className="w-full rounded-2xl border border-white/20 bg-black/25 p-3 text-white shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor }} />
            Enter code
          </div>
          <button type="button" onClick={resetToEmail} className="text-xs text-white/70 underline active:scale-95">
            Change email
          </button>
        </div>
        <div className="mt-1 truncate text-xs text-white/60">{email}</div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={10}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            placeholder="code"
            className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white px-3 py-2 text-center text-lg font-bold tracking-[0.3em] text-slate-900 outline-none focus:border-yellow-300"
          />
          <button
            type="submit"
            disabled={busy || code.trim().length < 6}
            className="rounded-xl bg-yellow-300 px-3 py-2 text-xs font-bold text-slate-900 active:scale-95 disabled:opacity-60"
          >
            Verify
          </button>
        </div>
        <p className="mt-2 text-xs leading-snug text-white/70">{authMessage || syncMessage}</p>
      </form>
    );
  }

  return (
    <form onSubmit={submitEmail} className="w-full rounded-2xl border border-white/20 bg-black/25 p-3 text-white shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor }} />
        Cloud Save
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="parent@email.com"
          className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-yellow-300"
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="rounded-xl bg-yellow-300 px-3 py-2 text-xs font-bold text-slate-900 active:scale-95 disabled:opacity-60"
        >
          Send code
        </button>
      </div>
      <p className="mt-2 text-xs leading-snug text-white/70">{authMessage || syncMessage}</p>
    </form>
  );
};

const HomeScreen = ({ equipped, prefs, inventoryCount, authPanel, onBattle, onInventory, onOpenSettings }) => {
  const preset = matchPreset(prefs);
  const opsHint = formatOpsHint(prefs.ops);
  const difficultyLabel = preset ? preset.name : 'Custom';

  return (
  <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-4 pb-6 sm:px-6">
    <div className="ml-auto w-full max-w-sm">{authPanel}</div>

    <main className="grid flex-1 items-center gap-6 py-5 md:grid-cols-[1fr_0.9fr] md:py-6">
      <section className="flex flex-col items-center text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-bold text-yellow-100 shadow-lg backdrop-blur-md">
          <span>✨</span>
          <span>Magic Math Quest</span>
        </div>
        <h1
          className="title-font text-5xl leading-none sm:text-6xl md:text-7xl"
          style={{
            background: 'linear-gradient(90deg, #fef08a, #f97316, #f9a8d4, #67e8f9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 5px 0 rgba(0,0,0,0.28))',
          }}
        >
          Math Dungeon
        </h1>
        <p className="mt-2 max-w-sm text-base font-semibold text-white/75 sm:text-lg">Answer, attack, and dress up your hero.</p>

        <div className="relative my-4 h-72 w-52 sm:h-80 sm:w-56" style={{ animation: 'bounce-bob 3s ease-in-out infinite' }}>
          <div
            className="absolute -bottom-2 left-1/2 h-5 w-36 -translate-x-1/2 rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.42), transparent 70%)' }}
          />
          <Avatar equipped={equipped} gender={prefs.gender} expression="happy" />
        </div>

        <div className="grid w-full max-w-sm gap-4">
          <button
            onClick={onBattle}
            className="chunky-btn flex items-center justify-center gap-3 rounded-2xl py-5 text-2xl text-white title-font"
            style={{ background: 'linear-gradient(135deg, #dc2626, #f97316)' }}
          >
            ⚔️ Enter Dungeon
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onInventory}
              className="chunky-btn flex items-center justify-center gap-2 rounded-2xl py-4 text-base text-white title-font"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
            >
              🎒 Inventory
              {inventoryCount > 0 && <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-xs text-yellow-950">{inventoryCount}</span>}
            </button>
            <button
              onClick={onOpenSettings}
              className="chunky-btn flex flex-col items-center justify-center gap-0.5 rounded-2xl py-3 text-white title-font"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)' }}
            >
              <span className="text-base">⚙️ Settings</span>
              <span className="text-[11px] font-normal opacity-80">{difficultyLabel} · {opsHint} · to {prefs.maxNumber}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="rounded-2xl border border-yellow-200/40 bg-yellow-100/15 p-4 text-left text-white shadow-lg backdrop-blur-md">
          <div className="title-font text-2xl leading-tight text-yellow-200">Loot gets fancier</div>
          <p className="mt-1 text-sm font-semibold text-white/70">Bigger HP battles unlock better chances for capes, auras, tools, and royal rewards.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold text-white">
            <div className="rounded-xl bg-white/10 p-2">
              <div className="text-lg">3 HP</div>
              <div className="text-pink-200">Cute</div>
            </div>
            <div className="rounded-xl bg-white/10 p-2">
              <div className="text-lg">4 HP</div>
              <div className="text-sky-200">Cool</div>
            </div>
            <div className="rounded-xl bg-white/10 p-2">
              <div className="text-lg">5 HP</div>
              <div className="text-yellow-200">Fancy</div>
            </div>
          </div>
        </div>
        <LootTeaser slot="aura" type="rainbow" color="cyan" title="Rainbow Aura" />
        <LootTeaser slot="face" type="star_glasses" color="gold" title="Star Glasses" />
        <LootTeaser slot="tool" type="wand" color="pink" title="Magic Wand" />
      </section>
    </main>
    <div className="mt-2 text-center text-[10px] text-white/40">Math Dungeon v{APP_VERSION}</div>
  </div>
  );
};

const LootTeaser = ({ slot, type, color, title }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-3 text-white shadow-lg backdrop-blur-md">
    <div className="h-24 w-16 flex-shrink-0">
      <Avatar equipped={{ [slot]: { slot, type, color } }} expression="happy" />
    </div>
    <div className="min-w-0">
      <div className="title-font text-xl leading-tight">{title}</div>
      <div className="text-sm font-semibold text-white/65">{getColorName(color)} reward</div>
    </div>
  </div>
);

const BattleScreen = ({
  enemy,
  enemyMaxHp,
  playerHp,
  question,
  selected,
  feedback,
  equipped,
  gender,
  playerAnim,
  enemyAnim,
  floatingText,
  onAnswer,
}) => {
  const enemyHpPct = (enemy.hp / enemyMaxHp) * 100;

  return (
    <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col p-3 pb-5 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 rounded-2xl border-2 border-white/20 bg-black/40 p-3 backdrop-blur">
          <div className="mb-1 text-sm font-bold text-white">You</div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: MAX_PLAYER_HP }).map((_, i) => (
              <Heart key={i} filled={i < playerHp} />
            ))}
          </div>
        </div>

        <div className="flex-1 rounded-2xl border-2 border-white/20 bg-black/40 p-3 backdrop-blur">
          <div className="mb-1 flex justify-between gap-2 text-sm font-bold text-white">
            <span className="truncate">{enemy.name}</span>
            <span>
              {enemy.hp}/{enemyMaxHp}
            </span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${enemyHpPct}%`,
                background: 'linear-gradient(90deg, #ef4444, #f87171)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="relative mb-4 flex min-h-[220px] items-end justify-between gap-2 sm:min-h-[280px]">
        <div className="relative w-28 flex-shrink-0 sm:w-40">
          <div className={`${playerAnim === 'attack' ? 'avatar-attack' : ''} ${playerAnim === 'hurt' ? 'avatar-hurt' : ''}`}>
            <Avatar equipped={equipped} gender={gender} expression={playerAnim === 'hurt' ? 'hurt' : 'normal'} />
          </div>
          {floatingText?.on === 'player' && (
            <FloatingText text={floatingText.text} color={floatingText.color} />
          )}
        </div>

        <div className="flex flex-1 items-center justify-center pb-16">
          <div className="text-5xl text-yellow-300" style={{ animation: 'wiggle 1s ease-in-out infinite' }}>
            ⚡
          </div>
        </div>

        <div
          className={`relative flex w-28 flex-shrink-0 items-end justify-center sm:w-40 ${enemyAnim === 'attack' ? 'enemy-attack' : ''} ${enemyAnim === 'hurt' ? 'enemy-hurt' : ''}`}
        >
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-xl"
              style={{ background: enemy.tint, opacity: 0.38, transform: 'scale(1.2)' }}
            />
            <div
              className="relative text-7xl sm:text-9xl"
              style={{
                animation: 'bounce-bob 2s ease-in-out infinite',
                filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.3))',
              }}
            >
              {enemy.emoji}
            </div>
          </div>
          {floatingText?.on === 'enemy' && (
            <FloatingText text={floatingText.text} color={floatingText.color} />
          )}
        </div>
      </div>

      <div className="mb-3 rounded-3xl bg-white/95 p-4 backdrop-blur sm:p-6" style={{ boxShadow: '0 10px 0 rgba(0,0,0,0.2), 0 20px 40px rgba(0,0,0,0.3)' }}>
        <div className="mb-1 text-center text-xs font-bold text-gray-500 sm:text-sm">ATTACK! Answer to strike!</div>
        <div className="flex items-center justify-center gap-2 title-font sm:gap-5" style={{ fontSize: 'clamp(2.35rem, 10vw, 4rem)' }}>
          <span style={{ color: '#3b82f6' }}>{question.a}</span>
          <span style={{ color: '#64748b' }}>{question.op}</span>
          <span style={{ color: '#f97316' }}>{question.b}</span>
          <span style={{ color: '#64748b' }}>=</span>
          <span
            className="inline-flex items-center justify-center rounded-2xl border-4 border-dashed"
            style={{
              width: '1.35em',
              height: '1.35em',
              borderColor: feedback === 'correct' ? '#22c55e' : feedback === 'wrong' ? '#ef4444' : '#cbd5e1',
              color: feedback === 'correct' ? '#22c55e' : feedback === 'wrong' ? '#ef4444' : '#94a3b8',
            }}
          >
            {selected !== null ? selected : '?'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {question.options.map((opt, i) => {
          const isSelected = selected === opt;
          const isCorrect = opt === question.answer;
          let bg = ['#ef4444', '#eab308', '#22c55e', '#3b82f6'][i];

          if (feedback) {
            if (isCorrect) bg = '#22c55e';
            else if (isSelected) bg = '#ef4444';
            else bg = '#6b7280';
          }

          return (
            <button
              key={`${question.a}-${question.b}-${i}`}
              onClick={() => onAnswer(opt)}
              disabled={feedback !== null}
              className="chunky-btn rounded-2xl py-5 text-4xl text-white title-font sm:py-6"
              style={{
                background: bg,
                animation: `pop-in 0.3s ease-out ${i * 0.05}s both`,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FloatingText = ({ text, color }) => (
  <div
    className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 text-4xl title-font"
    style={{
      color,
      animation: 'float-up 0.8s ease-out forwards',
      textShadow: '2px 2px 0 rgba(0,0,0,0.5)',
    }}
  >
    {text}
  </div>
);

const RewardScreen = ({ item, opened, onOpen, onClaim }) => {
  const colorValue = getColorValue(item.color);
  const colorName = getColorName(item.color);
  const slotInfo = SLOT_INFO[item.slot] || { label: 'Item', emoji: '🎁' };
  const rarity = getRarity(item.rarity);

  const confetti = useMemo(() => {
    if (!opened) return [];

    const colors = ['#fbbf24', '#ec4899', '#22c55e', '#3b82f6', '#a855f7', '#f97316'];
    return Array.from({ length: 56 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: colors[i % colors.length],
      size: 8 + Math.random() * 10,
      rotate: Math.random() * 360,
    }));
  }, [opened]);

  return (
    <div className="relative z-10 flex min-h-[100dvh] w-full flex-col items-center justify-center p-5 text-center">
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="pointer-events-none absolute top-0"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size,
            background: piece.color,
            borderRadius: piece.id % 3 === 0 ? '50%' : '2px',
            transform: `rotate(${piece.rotate}deg)`,
            animation: `confetti-fall ${piece.duration}s linear ${piece.delay}s infinite`,
          }}
        />
      ))}

      <h2 className="title-font mb-2 text-5xl text-yellow-300 sm:text-6xl" style={{ textShadow: '3px 3px 0 rgba(0,0,0,0.4)' }}>
        VICTORY!
      </h2>
      <p className="mb-6 text-lg font-semibold text-white/80">{opened ? rarity.badge : 'Tap the mystery box!'}</p>

      {!opened ? (
        <button
          onClick={onOpen}
          className="relative flex h-48 w-48 items-center justify-center text-9xl active:scale-95"
          style={{ animation: 'box-shake 0.6s ease-in-out infinite', background: 'transparent', border: 'none' }}
        >
          <div className="relative">🎁</div>
        </button>
      ) : (
        <div className="flex flex-col items-center" style={{ animation: 'pop-in 0.5s ease-out' }}>
          <div className="relative mb-4">
            <div
              className="relative rounded-3xl border-4 bg-white/10 p-4 shadow-2xl backdrop-blur"
              style={{ borderColor: rarity.accent, boxShadow: `0 0 0 6px ${rarity.glow}, 0 0 34px ${colorValue}66, 0 22px 50px rgba(0,0,0,0.35)` }}
            >
              <ItemAvatar item={item} className="mx-auto h-64 w-44" />
            </div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="absolute text-3xl"
                style={{
                  left: `${[8, 88, 5, 92, 18, 78][i]}%`,
                  top: `${[14, 20, 60, 55, 86, 80][i]}%`,
                  animation: `sparkle 1.5s ease-in-out ${i * 0.2}s infinite`,
                }}
              >
                ✨
              </div>
            ))}
          </div>

          <div className="mb-1 text-lg text-white/70">
            {slotInfo.emoji} {slotInfo.label}
          </div>
        <div className="title-font mb-1 text-3xl" style={{ color: colorValue, textShadow: '2px 2px 0 rgba(0,0,0,0.5)' }}>
          {colorName} {item.typeName}
        </div>
        <RarityBadge rarity={rarity} className="px-4 py-1 text-sm" />
        <div className="mt-2 text-sm font-bold text-white/80">
          {item.motifName || getMotifName(item.motif)} motif · {item.finish || 'magic'} finish
        </div>
        <div className="mt-2 text-sm font-semibold text-white/65">
          Found from {item.sourceEnemy || 'the dungeon'}{item.sourceHp ? ` · ${item.sourceHp} HP` : ''}
        </div>

        <button
          onClick={onClaim}
            className="chunky-btn mt-6 rounded-full px-10 py-4 text-xl text-white title-font"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
          >
            Claim & Return 🏠
          </button>
        </div>
      )}
    </div>
  );
};

const InventoryScreen = ({ inventory, equipped, gender, onEquip, onBack, authPanel }) => {
  const [activeSlot, setActiveSlot] = useState('hat');
  const [activeRarity, setActiveRarity] = useState('all');

  useEffect(() => {
    setActiveRarity('all');
  }, [activeSlot]);

  const bySlot = useMemo(() => {
    const groups = Object.fromEntries(SLOT_ORDER.map((slot) => [slot, []]));
    for (const item of inventory) {
      if (groups[item.slot]) groups[item.slot].push(item);
    }
    return groups;
  }, [inventory]);

  const slotItems = bySlot[activeSlot] || [];

  const rarityCounts = useMemo(() => {
    const counts = {};
    for (const item of slotItems) counts[item.rarity] = (counts[item.rarity] || 0) + 1;
    return counts;
  }, [slotItems]);

  const filtered = useMemo(() => {
    const list = activeRarity === 'all' ? slotItems : slotItems.filter((item) => item.rarity === activeRarity);
    return [...list].sort((a, b) => b.id - a.id);
  }, [slotItems, activeRarity]);

  return (
    <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col p-4 pb-6 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="chunky-btn rounded-full px-5 py-2.5 text-white title-font"
          style={{ background: 'linear-gradient(135deg, #475569, #334155)' }}
        >
          ← Back
        </button>
        <h2 className="title-font truncate text-3xl text-white" style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.4)' }}>
          🎒 Inventory
        </h2>
      </div>

      <div className="mb-4 ml-auto w-full max-w-sm">{authPanel}</div>

      <div className="grid gap-4 md:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border-2 border-white/20 bg-black/30 p-4 backdrop-blur">
          <h3 className="title-font mb-2 text-center text-xl text-white">Your Hero</h3>
          <div className="mx-auto mb-3 h-72 w-48">
            <Avatar equipped={equipped} gender={gender} expression="happy" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {SLOT_ORDER.map((slot) => (
              <div key={slot} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                <span className="text-lg">{SLOT_INFO[slot].emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-white/60">{SLOT_INFO[slot].label}</div>
                  <div className="truncate text-sm text-white">
                    {equipped[slot] ? (
                      <span style={{ color: getColorValue(equipped[slot].color) }}>{equipped[slot].typeName}</span>
                    ) : (
                      <span className="text-white/40">None</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border-2 border-white/20 bg-black/30 p-4 backdrop-blur">
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2">
            {SLOT_ORDER.map((slot) => {
              const count = bySlot[slot]?.length || 0;
              const isActive = activeSlot === slot;
              return (
                <button
                  key={slot}
                  onClick={() => setActiveSlot(slot)}
                  className="min-w-[72px] rounded-xl px-3 py-2 text-center transition-all"
                  style={{
                    background: isActive ? 'white' : 'rgba(255,255,255,0.1)',
                    color: isActive ? '#1e1b4b' : 'white',
                    transform: isActive ? 'translateY(-2px)' : 'none',
                    boxShadow: isActive ? '0 4px 0 rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <div className="text-xl">{SLOT_INFO[slot].emoji}</div>
                  <div className="text-xs font-bold">{count}</div>
                </button>
              );
            })}
          </div>

          {slotItems.length > 0 && (
            <div className="-mx-1 mb-3 flex flex-wrap gap-1.5 px-1">
              {[{ id: 'all', name: 'All', accent: '#ffffff' }, ...RARITIES].map((r) => {
                const count = r.id === 'all' ? slotItems.length : rarityCounts[r.id] || 0;
                if (r.id !== 'all' && count === 0) return null;
                const isActive = activeRarity === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setActiveRarity(r.id)}
                    className="rounded-full px-3 py-1 text-xs font-bold transition-all"
                    style={{
                      background: isActive ? r.accent : 'rgba(255,255,255,0.1)',
                      color: isActive ? '#1e1b4b' : 'white',
                      boxShadow: isActive ? '0 2px 0 rgba(0,0,0,0.3)' : 'none',
                    }}
                  >
                    {r.name} <span className="opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-white/50">
              <div className="mb-2 text-5xl opacity-50">{SLOT_INFO[activeSlot].emoji}</div>
              <p>
                {slotItems.length === 0
                  ? `No ${SLOT_INFO[activeSlot].label.toLowerCase()}s yet.`
                  : `No ${getRarity(activeRarity).name.toLowerCase()} ${SLOT_INFO[activeSlot].label.toLowerCase()}s.`}
              </p>
              <p className="mt-1 text-sm">Defeat enemies to find more!</p>
            </div>
          ) : (
            <div className="grid max-h-[30rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {filtered.map((item) => {
                const equippedHere = equipped[item.slot]?.id === item.id;
                const rarity = getRarity(item.rarity);
                const itemColor = getColorValue(item.color);
                return (
                  <button
                    key={item.id}
                    onClick={() => onEquip(item)}
                    className="relative rounded-2xl p-2 transition-all"
                    style={{
                      background: equippedHere ? itemColor : 'rgba(255,255,255,0.08)',
                      border: `3px solid ${equippedHere ? '#ffffff' : itemColor}`,
                      transform: equippedHere ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: equippedHere ? `0 0 0 4px ${rarity.glow}, 0 0 20px ${itemColor}` : `0 0 14px ${rarity.glow}`,
                    }}
                  >
                    <ItemAvatar item={item} className="mx-auto h-28 w-20" />
                    <div className="mt-1 truncate text-xs font-bold text-white" style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.7)' }}>
                      {item.typeName}
                    </div>
                    <RarityBadge rarity={rarity} className="mx-auto mt-1" />
                    <div className="mt-1 truncate text-[10px] font-bold text-white/70">
                      {item.motifName || getMotifName(item.motif)} · {item.finish || 'magic'}
                    </div>
                    <div className="mt-1 truncate text-[10px] font-bold text-white/55">
                      {item.sourceEnemy || 'Dungeon'}{item.sourceHp ? ` · ${item.sourceHp} HP` : ''}
                    </div>
                    {equippedHere && (
                      <div className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-green-600">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-center text-xs text-white/45">
            Showing {filtered.length} of {slotItems.length} · newest first · tap to equip or unequip
          </p>
        </div>
      </div>
    </div>
  );
};

const GameOverScreen = ({ onRetry, onHome }) => (
  <div className="relative z-10 flex min-h-[100dvh] w-full flex-col items-center justify-center p-6 text-center">
    <div className="mb-4 text-8xl" style={{ animation: 'wiggle 1s ease-in-out infinite' }}>
      💀
    </div>
    <h2 className="title-font mb-2 text-5xl text-white" style={{ textShadow: '3px 3px 0 rgba(0,0,0,0.5)' }}>
      Defeated!
    </h2>
    <p className="mb-8 text-lg text-white/80">Don't give up. Try again!</p>
    <div className="flex w-full max-w-xs flex-col gap-3">
      <button
        onClick={onRetry}
        className="chunky-btn rounded-2xl py-4 text-xl text-white title-font"
        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
      >
        ⚔️ Try Again
      </button>
      <button
        onClick={onHome}
        className="chunky-btn rounded-2xl py-3 text-lg text-white title-font"
        style={{ background: 'linear-gradient(135deg, #475569, #334155)' }}
      >
        🏠 Home
      </button>
    </div>
  </div>
);
