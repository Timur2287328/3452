import * as THREE from 'three';
import { C, mat, box, pivot, addLabel } from './lib.js';

// Предметы-реплики диалога. Каждый билдер возвращает группу с началом координат на полу (y = 0).
const PASTEL = [0xF4A7B9, 0xA7D8F4, 0xB8E6B0, 0xF7D59C, 0xCDB8F2, 0xF6B98F];
const INK = '#2B211C';

export function idea() {
  const g = new THREE.Group();
  box(0.7, 0.7, 0.7, C.cardboard, 0, 0.35, 0, g, 0.05);
  box(0.72, 0.02, 0.16, C.tape, 0, 0.705, 0, g, 0.008);
  box(0.16, 0.3, 0.02, C.tape, 0, 0.56, 0.352, g, 0.008);
  addLabel(g, 'ИДЕЯ', 0.6, 0.2, 0, 0.26, 0.353, { fg: '#5A3B22' });
  return g;
}

export function hourglass() {
  const g = new THREE.Group();
  box(0.8, 0.12, 0.8, C.wood, 0, 0.06, 0, g, 0.03);
  box(0.8, 0.12, 0.8, C.wood, 0, 1.24, 0, g, 0.03);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.06, 1.06, 0.06, C.wood, x * 0.34, 0.65, z * 0.34, g, 0.02);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.06, 0.56),
    new THREE.MeshStandardMaterial({ color: 0xDDEEFF, transparent: true, opacity: 0.25, roughness: 0.1 }));
  glass.position.y = 0.65; g.add(glass);
  const top = pivot(g, 0, 0.68, 0), bottom = pivot(g, 0, 0.12, 0);
  box(0.46, 0.48, 0.46, C.sand, 0, 0.24, 0, top, 0.06);
  box(0.46, 0.48, 0.46, C.sand, 0, 0.24, 0, bottom, 0.06);
  const stream = box(0.03, 0.56, 0.03, C.sand, 0, 0.4, 0, g, 0.01);
  addLabel(g, 'сейчас…', 0.72, 0.11, 0, 1.24, 0.402, { fg: '#FFF3E0' });
  g.userData.setSand = p => {
    p = Math.min(1, Math.max(0, p));
    top.scale.y = Math.max(0.02, 1 - p); bottom.scale.y = Math.max(0.02, p);
    stream.visible = p > 0.01 && p < 0.99;
  };
  g.userData.setSand(0);
  return g;
}

export function laptop() {
  const g = new THREE.Group();
  box(0.9, 0.06, 0.62, C.metal, 0, 0.03, 0, g, 0.02);
  box(0.8, 0.01, 0.34, C.metalDark, 0, 0.062, -0.05, g, 0.004);
  const hinge = pivot(g, 0, 0.06, -0.29);
  hinge.rotation.x = -0.25;
  box(0.9, 0.6, 0.04, C.bezel, 0, 0.3, 0, hinge, 0.015);
  box(0.8, 0.5, 0.01, mat(C.screen, { emissive: C.screen, emissiveIntensity: 0.6 }), 0, 0.3, 0.021, hinge, 0.004);
  // На экране — крошечные мы: Claude и Ты.
  box(0.12, 0.09, 0.01, C.claude, -0.14, 0.2, 0.03, hinge, 0.004);
  box(0.09, 0.15, 0.01, C.hood, 0.13, 0.22, 0.03, hinge, 0.004);
  box(0.08, 0.08, 0.01, C.skin, 0.13, 0.34, 0.03, hinge, 0.004);
  box(0.1, 0.03, 0.01, C.hair, 0.13, 0.385, 0.031, hinge, 0.004);
  return g;
}

export function bulb(s = 1) {
  const g = new THREE.Group(), b = pivot(g, 0, 0, 0);
  const glow = mat(0xFFE58A, { emissive: 0xFFD54A, emissiveIntensity: 0.8 });
  box(0.26, 0.2, 0.26, C.metal, 0, 0.1, 0, b, 0.04);
  for (const y of [0.06, 0.14]) box(0.28, 0.025, 0.28, C.metalDark, 0, y, 0, b, 0.01);
  box(0.34, 0.12, 0.34, glow, 0, 0.25, 0, b, 0.05);
  box(0.5, 0.5, 0.5, glow, 0, 0.55, 0, b, 0.14);
  b.scale.setScalar(s);
  return g;
}

export function door(n) {
  const g = new THREE.Group();
  for (const x of [-0.3, 0.3]) box(0.1, 1.1, 0.14, C.doorFrame, x, 0.55, 0, g, 0.03);
  box(0.7, 0.1, 0.14, C.doorFrame, 0, 1.05, 0, g, 0.03);
  // Проём: сюда кладётся картинка «эта же комната» (рекурсия за дверью 1).
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  portal.position.set(0, 0.5, -0.02); g.add(portal);
  const slab = pivot(g, -0.25, 0, 0.02);
  box(0.5, 0.98, 0.08, C.door, 0.25, 0.5, 0, slab, 0.03);
  box(0.06, 0.06, 0.06, C.knob, 0.43, 0.48, 0.06, slab, 0.02);
  addLabel(slab, String(n), 0.22, 0.22, 0.25, 0.8, 0.042, { fg: '#FFFFFF', bg: '#8A5A3B' });
  g.userData = { slab, portal };
  return g;
}

export function duck() {
  const g = new THREE.Group();
  box(0.4, 0.34, 0.5, C.duck, 0, 0.17, 0, g, 0.1);
  box(0.14, 0.14, 0.1, C.duck, 0, 0.3, -0.26, g, 0.04);
  box(0.28, 0.28, 0.26, C.duck, 0, 0.47, 0.12, g, 0.08);
  box(0.14, 0.06, 0.12, C.beak, 0, 0.43, 0.3, g, 0.02);
  for (const s of [-1, 1]) box(0.04, 0.06, 0.02, C.eye, s * 0.07, 0.52, 0.255, g, 0.008);
  return g;
}

export function ok(i) {
  const g = new THREE.Group();
  box(0.32, 0.32, 0.32, PASTEL[i % PASTEL.length], 0, 0.16, 0, g, 0.05);
  addLabel(g, 'ок', 0.24, 0.16, 0, 0.16, 0.162, { fg: INK });
  addLabel(g, 'ок', 0.24, 0.16, 0, 0.322, 0, { fg: INK }, -Math.PI / 2);
  return g;
}

export function weight() {
  const g = new THREE.Group();
  box(0.9, 0.5, 0.6, C.iron, 0, 0.25, 0, g, 0.08);
  box(0.6, 0.12, 0.45, C.iron, 0, 0.56, 0, g, 0.05);
  for (const s of [-1, 1]) box(0.08, 0.26, 0.1, C.iron, s * 0.2, 0.74, 0, g, 0.03);
  box(0.48, 0.08, 0.1, C.iron, 0, 0.86, 0, g, 0.03);
  addLabel(g, 'без ошибок', 0.8, 0.2, 0, 0.27, 0.302, { fg: '#FFFFFF' });
  return g;
}

export function summary() {
  const g = new THREE.Group();
  box(0.45, 0.45, 0.45, C.paper, 0, 0.225, 0, g, 0.04);
  addLabel(g, 'Краткое\nсодержание', 0.4, 0.22, 0, 0.29, 0.227, { fg: INK });
  // Приписка маркером в финале: проявляется слева направо через repeat текстуры.
  const note = addLabel(g, '+ уточка', 0.36, 0.11, 0, 0.1, 0.228, { fg: '#2F6FD0', weight: 600 });
  note.material = note.material.clone(); note.material.map = note.material.map.clone();
  g.userData.setNote = k => {
    note.visible = k > 0.001; note.scale.x = Math.max(0.001, k); note.position.x = -0.18 * (1 - k);
    note.material.map.repeat.x = Math.max(0.001, k); note.material.map.needsUpdate = true;
  };
  g.userData.setNote(0);
  addLabel(g, 'Краткое\nсодержание', 0.4, 0.26, 0, 0.452, 0, { fg: INK }, -Math.PI / 2);
  return g;
}

function stripes(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * 128); cv.height = Math.round(h * 128);
  const x = cv.getContext('2d'), s = cv.height;
  x.fillStyle = '#F2C230'; x.fillRect(0, 0, cv.width, s);
  x.fillStyle = '#2B2730';
  for (let i = 0; i < cv.width + s; i += s) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s / 2, 0); x.lineTo(i - s / 2, s); x.lineTo(i - s, s); x.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
}

// Пресс: начало координат — центр плиты (толщина 0.5), шток уходит вверх.
export const PRESS = { w: 3.8, d: 3.4, half: 0.25 };
export function press() {
  const g = new THREE.Group();
  box(PRESS.w, 0.5, PRESS.d, C.press, 0, 0, 0, g, 0.08);
  const st = stripes(PRESS.w - 0.1, 0.3); st.position.set(0, 0, PRESS.d / 2 + 0.005); g.add(st);
  addLabel(g, 'СЖАТИЕ', 1.3, 0.3, 0, 0, PRESS.d / 2 + 0.01, { fg: INK, bg: '#F2C230' });
  box(0.6, 12, 0.6, C.metalDark, 0, 6.25, 0, g, 0.05);
  box(1.2, 0.2, 1.2, C.press, 0, 0.35, 0, g, 0.05);
  return g;
}

// Коробка для физики по габаритам меша (вызывать, пока группа стоит в начале координат).
export function physBox(obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const size = b.getSize(new THREE.Vector3()), center = b.getCenter(new THREE.Vector3());
  return { half: size.clone().multiplyScalar(0.5), offset: center, volume: size.x * size.y * size.z };
}
