import * as THREE from 'three';
import { C, box, pivot, addLabel } from './lib.js';

export const ROOM = { w: 5, d: 4, h: 6 };

// Комната памяти: стены, дверь = поле ввода чата, индикатор «Контекст N%».
export function buildRoom() {
  const g = new THREE.Group();
  const { w, d, h } = ROOM, back = -d / 2;
  box(w + 0.4, 0.2, d + 0.2, C.floor, 0, -0.1, 0, g, 0.04);
  box(w + 0.4, h, 0.2, C.wall, 0, h / 2, back - 0.1, g, 0.04);
  for (const s of [-1, 1]) box(0.2, h, d + 0.2, C.wall2, s * (w / 2 + 0.1), h / 2, 0, g, 0.04);
  box(w, 0.14, 0.06, C.skirt, 0, 0.07, back + 0.03, g, 0.02);
  for (const s of [-1, 1]) box(0.06, 0.14, d, C.skirt, s * (w / 2 - 0.03), 0.07, 0, g, 0.02);

  const door = pivot(g, -1.3, 0, back + 0.02);
  box(1.3, 2.45, 0.1, C.doorFrame, 0, 1.225, 0, door, 0.03);
  const slab = pivot(door, -0.55, 0, 0.05);
  box(1.1, 2.3, 0.08, C.door, 0.55, 1.15, 0, slab, 0.03);
  box(0.09, 0.09, 0.09, C.knob, 0.97, 1.1, 0.07, slab, 0.02);

  box(1.9, 0.38, 0.06, C.field, -1.3, 2.85, back + 0.04, g, 0.06);
  addLabel(g, 'Напишите сообщение…', 1.5, 0.2, -1.2, 2.85, back + 0.075, { fg: '#8C8C96', weight: 400 });
  const cursor = box(0.035, 0.24, 0.02, C.cursor, -2.04, 2.85, back + 0.08, g, 0.005);

  box(2.15, 0.62, 0.06, C.field, 0.2, 4.3, back + 0.04, g, 0.06);
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const meter = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  meter.position.set(0.2, 4.3, back + 0.075); g.add(meter);
  function setContext(p, dim = false) {
    const x = cv.getContext('2d');
    x.clearRect(0, 0, 1024, 256);
    x.fillStyle = '#FFFFFF'; x.font = '700 96px system-ui, "Segoe UI", sans-serif'; x.textBaseline = 'top';
    x.fillText(`Контекст: ${Math.round(p)}%`, 40, 20);
    x.fillStyle = '#4A4550'; x.beginPath(); x.roundRect(40, 160, 944, 56, 28); x.fill();
    x.fillStyle = dim ? '#6B5A3A' : p < 70 ? '#4CAF7A' : p < 97 ? '#E9A23B' : p < 100 ? '#F2C230' : '#E05A4F';
    x.beginPath(); x.roundRect(40, 160, Math.max(56, 944 * Math.min(p, 100) / 100), 56, 28); x.fill();
    tex.needsUpdate = true;
  }
  setContext(0);

  const sign = addLabel(g, 'КОНТЕКСТ ЗАПОЛНЕН\nСЖАТИЕ…', 2.4, 0.7, 0.2, 5.3, back + 0.08, { fg: '#FFFFFF', bg: '#C8372D' });
  sign.visible = false;

  const colliders = [
    { pos: [0, -0.1, 0], half: [w / 2 + 0.2, 0.1, d / 2 + 0.1] },
    { pos: [0, h / 2, back - 0.1], half: [w / 2 + 0.2, h / 2, 0.1] },
    { pos: [-(w / 2 + 0.1), h / 2, 0], half: [0.1, h / 2, d / 2 + 0.1] },
    { pos: [w / 2 + 0.1, h / 2, 0], half: [0.1, h / 2, d / 2 + 0.1] },
    { pos: [0, h / 2, d / 2 + 0.1], half: [w / 2 + 0.2, h / 2, 0.1], invisible: true },
  ];
  return { group: g, setContext, sign, slab, colliders, tick: t => { cursor.visible = Math.floor(t * 2) % 2 === 0; } };
}
