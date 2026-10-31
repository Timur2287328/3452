import * as THREE from 'three';
import { C, box, pivot } from './lib.js';

export function buildTy() {
  const ty = new THREE.Group();
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(ty, s * 0.22, 0.77, 0);
    box(0.32, 0.7, 0.36, C.jeans, 0, -0.35, 0, hip);
    box(0.36, 0.14, 0.48, C.shoe, 0, -0.7, 0.05, hip);
    legs.push(hip);
  }
  box(1.15, 1.1, 0.62, C.hood, 0, 1.3, 0, ty, 0.12);
  box(0.6, 0.3, 0.04, C.pocket, 0, 1.0, 0.32, ty, 0.02);
  box(0.26, 0.26, 0.04, C.skin2, 0, 1.8, 0.3, ty, 0.02).rotation.z = Math.PI / 4;
  box(0.9, 0.22, 0.3, C.hood, 0, 1.88, -0.2, ty, 0.08);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(ty, s * 0.72, 1.78, 0);
    box(0.26, 0.95, 0.3, C.hood, 0, -0.47, 0, sh, 0.08);
    box(0.24, 0.22, 0.24, C.skin, 0, -1.05, 0, sh, 0.06);
    arms.push(sh);
  }
  box(0.34, 0.25, 0.3, C.skin2, 0, 1.92, 0, ty, 0.04);
  const head = pivot(ty, 0, 2.5, 0);
  box(1.0, 1.1, 0.95, C.skin, 0, 0, 0, head, 0.12);
  const lids = [], brows = [], sides = [], locks = [], ants = [];
  for (const s of [-1, 1]) {
    box(0.12, 0.16, 0.03, C.eye, s * 0.2, 0, 0.475, head, 0.02);
    const lid = pivot(head, s * 0.2, 0.09, 0.485);
    box(0.16, 0.08, 0.03, C.skin, 0, -0.04, 0, lid, 0.012);
    box(0.17, 0.025, 0.035, C.eye, 0, -0.08, 0.005, lid, 0.01);
    lids.push(lid);
    brows.push(box(0.26, 0.07, 0.05, C.eye, s * 0.21, 0.21, 0.48, head, 0.015));
    const side = pivot(head, s * 0.57, 0.55, -0.03);
    box(0.16, 1.45, 1.0, C.hair, 0, -0.72, 0, side, 0.06);
    sides.push(side);
    const lock = pivot(head, s * 0.43, 0.5, 0.47);
    box(0.14, 1.0, 0.08, C.hair, 0, -0.5, 0, lock, 0.03);
    locks.push(lock);
    box(0.55, 0.22, 1.12, C.hair, s * 0.28, 0.6, -0.02, head, 0.08).rotation.z = -s * 0.08;
  }
  box(0.08, 0.12, 0.06, C.skin2, 0, -0.1, 0.49, head, 0.02);
  const mouth = box(0.17, 0.03, 0.03, C.mouth, 0, -0.28, 0.48, head, 0.01);
  box(1.18, 1.5, 0.18, C.hair, 0, -0.22, -0.52, head, 0.06);
  const strand = pivot(head, -0.1, 0.55, 0.51);
  box(0.07, 0.62, 0.06, C.hair, 0, -0.3, 0, strand, 0.02);
  return { ty, head, arms, legs, lids, brows, sides, locks, strand, ants, mouth };
}

// bam: 1 → 0 после удара (волосы дыбом и медленно оседают), puff: 1 → 0 после «сдуть прядь».
export function tyRig(T) {
  let blink = 0, nextBlink = 2, t = 0;
  return (dt, { bam = 0, puff = 0 } = {}) => {
    t += dt;
    const pop = bam * bam, wob = Math.sin((1 - bam) * 22) * bam * 0.25;
    T.sides.forEach((p, i) => { const s = i ? 1 : -1; p.rotation.z = s * (pop * 1.1 + wob + 0.02 * Math.sin(t * 1.5)); });
    T.locks.forEach((p, i) => { const s = i ? 1 : -1; p.rotation.z = s * (pop * 0.9 + wob); });
    T.ants.forEach(a => a.scale.y = 1 + pop * 2.5);
    T.strand.rotation.z = 0.12 + Math.sin(puff * Math.PI) * 2.2 + wob * 2;
    T.head.position.y = 2.5 + 0.012 * Math.sin(t * 2);
    T.head.rotation.x = -Math.sin(puff * Math.PI) * 0.12;
    T.arms.forEach((a, i) => a.rotation.z = (i ? 1 : -1) * (0.04 + 0.02 * Math.sin(t * 2)));
    if (t > nextBlink) { blink = 0.14; nextBlink = t + 2 + ((t * 7919) % 3); }
    blink -= dt; T.lids.forEach(l => l.scale.y = blink > 0 ? 2.2 : 1);
    return { pop, wob };
  };
}

export function buildClaude() {
  const g = new THREE.Group();
  const body = pivot(g, 0, 0.3, 0);
  box(0.9, 0.72, 0.72, C.claude, 0, 0.36, 0, body, 0.08);
  // Свой материал глаз: в кульминации они вспыхивают, а у Ты глаза должны остаться тёмными.
  const eyeMat = new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.65, emissive: 0xFFE2B0, emissiveIntensity: 0 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = pivot(body, s * 0.17, 0.45, 0.365);
    box(0.08, 0.2, 0.03, eyeMat, 0, 0, 0, e, 0.01);
    eyes.push(e);
    box(0.16, 0.14, 0.14, C.claude, s * 0.52, 0.32, 0, body, 0.04);
  }
  for (const x of [-0.3, -0.1, 0.1, 0.3]) box(0.1, 0.3, 0.12, C.claude, x, 0.15, 0, g, 0.03);
  return { g, body, eyes, eyeMat };
}
