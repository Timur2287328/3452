import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const C = {
  skin: 0xEFCDB4, skin2: 0xE3B79B, hair: 0x221C24, hood: 0x1C1C22, pocket: 0x2A2A33, eye: 0x1E1A1F,
  mouth: 0xB87468, jeans: 0x2E3440, shoe: 0xEDEDED, claude: 0xD97757,
  floor: 0x2B221F, wall: 0x232636, wall2: 0x1C1F2C, skirt: 0x14161F,
  doorFrame: 0x4A3226, door: 0x8C5A38, knob: 0xE8C35A, field: 0x16151C, cursor: 0xFFFFFF,
  cardboard: 0xC89B6A, tape: 0xE8D3A8, wood: 0xA8744F, metal: 0x9AA0A8, metalDark: 0x6E757E,
  bezel: 0x2B2F36, screen: 0x3A6EA5, iron: 0x3A3D42, duck: 0xF5C518, beak: 0xF08A24,
  sand: 0xE6C27A, paper: 0xEDE3D1, press: 0x5B6270, hazard: 0xF2C230,
};

const mats = new Map();
export function mat(c, extra = {}) {
  const key = c + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, ...extra }));
  return mats.get(key);
}

export function box(w, h, d, c, x, y, z, parent, r) {
  const material = c instanceof THREE.Material ? c : mat(c);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r ?? Math.min(w, h, d) * 0.18), material);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}

export function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

const labelMats = new Map();
export function labelPlane(text, w, h, o = {}) {
  const key = [text, w, h, o.fg, o.bg, o.weight].join('|');
  if (!labelMats.has(key)) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * 256); cv.height = Math.round(h * 256);
    const g = cv.getContext('2d');
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, cv.width, cv.height); }
    const lines = text.split('\n');
    let fs = cv.height / lines.length * 0.72;
    const font = () => `${o.weight ?? 800} ${fs}px system-ui, "Segoe UI", sans-serif`;
    g.font = font();
    const maxW = Math.max(...lines.map(l => g.measureText(l).width));
    if (maxW > cv.width * 0.9) { fs *= cv.width * 0.9 / maxW; g.font = font(); }
    g.fillStyle = o.fg ?? '#2B211C'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, cv.width / 2, cv.height * (i + 0.5) / lines.length));
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    labelMats.set(key, new THREE.MeshStandardMaterial({ map: tex, transparent: !o.bg, roughness: 0.8 }));
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), labelMats.get(key));
  m.receiveShadow = true;
  return m;
}

export function addLabel(parent, text, w, h, x, y, z, o, rotX = 0, rotY = 0) {
  const l = labelPlane(text, w, h, o);
  l.position.set(x, y, z); l.rotation.set(rotX, rotY, 0); parent.add(l); return l;
}

// Детерминированный генератор случайных чисел: один и тот же seed даёт одинаковый кадр при каждом рендере.
export function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
