import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { C, box, pivot, mat, rng } from './lib.js';
import { buildTy, buildClaude } from './characters.js';
import { buildRoom } from './room.js';
import * as P from './props.js';
import { simulate, poseAt } from './sim.js';
import {
  T, clamp01, lerp, smooth, span, sceneTime, claudeX, claudeBaseSY, CLAUDE_Z, TY_HOME, TY_DOOR,
  contextAt, sandAt, plateY, blinking, talking,
} from './timeline.js';

const easeOutBack = k => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2);
const popIn = (tm, at, dur = 0.25) => easeOutBack(span(tm, at, at + dur));
// Затухающий «удар»: 0 до события, потом колебание вокруг нуля.
const pulse = (tm, at, f = 16, d = 6) => (tm < at ? 0 : Math.exp(-(tm - at) * d) * Math.cos((tm - at) * f));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Камера по ключам [время ролика, позиция, цель]; между ключами — плавный переход.
const WIDE = [V(0, 3.5, 12.5), V(0, 2.6, 0)];
const CAM = [
  [0, V(0.5, 2.2, 7.8), V(0.3, 2.6, 0.3)], [1.9, V(0.5, 2.0, 6.6), V(0.3, 2.4, 0.3)], [2.2, V(0.5, 2.0, 6.6), V(0.3, 2.4, 0.3)],
  [3.0, ...WIDE], [6.6, ...WIDE], [7.4, V(0.2, 3.2, 11), V(0.2, 2.4, 0)], [11.0, V(0.2, 3.2, 11), V(0.2, 2.4, 0)],
  [11.5, ...WIDE], [14.0, ...WIDE], [14.6, V(0.4, 3.0, 10.5), V(0.3, 2.2, 0)], [17.2, V(0.4, 3.0, 10.5), V(0.3, 2.2, 0)],
  [17.8, ...WIDE], [20.6, ...WIDE], [21.2, V(-0.6, 1.45, 1.7), V(-0.15, 0.6, -1.55)], [22.3, V(-0.6, 1.45, 1.7), V(-0.15, 0.6, -1.55)],
  [22.9, ...WIDE], [25.6, ...WIDE], [26.1, V(0.7, 3.7, 5.8), V(0.45, 2.1, 0.8)], [26.7, V(0.7, 3.7, 5.8), V(0.45, 2.1, 0.8)],
  [27.3, ...WIDE], [31.0, ...WIDE], [36.5, V(0, 3.3, 11.6), V(0, 2.5, 0)], [38.2, V(0, 3.3, 11.6), V(0, 2.5, 0)],
  [38.8, ...WIDE], [43.0, ...WIDE], [43.8, V(0.75, 2.4, 9.4), V(0.85, 2.05, 0.6)], [56.8, V(0.75, 2.4, 9.4), V(0.85, 2.05, 0.6)],
  [57.4, V(0.85, 2.8, 6.9), V(0.95, 2.15, 0.8)], [59.8, V(0.85, 2.8, 6.9), V(0.95, 2.15, 0.8)],
  [60.4, ...WIDE], [66.4, ...WIDE], [67.0, V(0.15, 0.85, 3.0), V(0.05, 0.25, 1.55)], [68.1, V(0.15, 0.85, 3.0), V(0.05, 0.25, 1.55)],
  [68.6, ...WIDE],
];
function camAt(t, pos, tgt) {
  let i = 0;
  while (i < CAM.length - 1 && CAM[i + 1][0] <= t) i++;
  const a = CAM[i], b = CAM[Math.min(i + 1, CAM.length - 1)];
  const k = b === a ? 0 : smooth(span(t, a[0], b[0]));
  pos.lerpVectors(a[1], b[1], k); tgt.lerpVectors(a[2], b[2], k);
}

export function createFilm(canvas, { width, height, pixelRatio = 1 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;  // PCF + radius — мягкий край тени

  // Сцена → ambient occlusion (GTAO: темнеют стыки, углы, место касания пола) → вывод. MSAA в буфере композера.
  function composerFor(sc, camera) {
    const rt = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(renderer, rt);
    c.addPass(new RenderPass(sc, camera));
    const ao = new GTAOPass(sc, camera, width, height);
    ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 16 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    ao.blendIntensity = 1;
    c.addPass(ao); c.addPass(new OutputPass());
    return c;
  }
  const softShadow = (light, size, radius) => {
    light.castShadow = true; light.shadow.mapSize.set(size, size);
    light.shadow.radius = radius; light.shadow.bias = -0.0004; light.shadow.normalBias = 0.025;
  };

  // ---------- Комната памяти: вечер, тёплый свет сверху, холодный контровой ----------
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0B0C12);
  const cam = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  const hemi = new THREE.HemisphereLight(0x7F89B0, 0x1A1418, 0.35); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xFFD7AE, 0.9); sun.position.set(3, 9, 6);
  softShadow(sun, 4096, 3); Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 8, bottom: -2 }); scene.add(sun);
  const lamp = new THREE.SpotLight(0xFFC27A, 45, 0, 0.75, 0.75, 2); lamp.position.set(0.3, 5.8, 2.2); lamp.target.position.set(0, 0, 0);
  softShadow(lamp, 2048, 6); lamp.shadow.camera.near = 1; scene.add(lamp, lamp.target);
  const rim = new THREE.DirectionalLight(0x8FB0FF, 1.8); rim.position.set(-5, 5, -8); scene.add(rim);
  const siren = new THREE.PointLight(0xFF2A1A, 0, 0, 2); siren.position.set(-0.6, 5, 0.5); scene.add(siren);

  const R = buildRoom(); scene.add(R.group);
  const Ty = buildTy(); scene.add(Ty.ty);
  const K = buildClaude(); scene.add(K.g);
  const H = P.hourglass(); H.position.set(-1.85, 0, 0.9); scene.add(H);
  const PR = P.press(); PR.position.set(0.55, 8.5, 0.3); scene.add(PR);
  const S = P.summary(); scene.add(S);
  const handDuck = P.duck(); handDuck.scale.setScalar(0.55); handDuck.position.set(0, -1.18, 0.06); Ty.arms[0].add(handDuck);

  // ---------- Предметы-реплики ----------
  const pile = new THREE.Group(); scene.add(pile);
  const rand = rng(42), items = [];
  const add = (obj, t, pos, kind, massK, still) => { items.push({ obj, t, pos, kind, massK, still }); pile.add(obj); };
  add(P.idea(), T.ideaDrop, [-1.0, 5.5, 1.3], 'idea');
  add(P.laptop(), T.laptop, [-0.55, 5.2, 0.6], 'laptop');
  add(P.bulb(1), T.bulbs[0], [-2.0, 5.0, -0.3], 'bulb');
  add(P.bulb(1.6), T.bulbs[1], [-2.0, 5.2, -0.15], 'bulb');
  add(P.bulb(2.4), T.bulbs[2], [claudeX(T.bulbs[2]) - 0.12, 4.6, CLAUDE_Z], 'bulb', 1, 0.05);
  add(P.duck(), T.duck, [claudeX(T.duck) - 0.1, 5.4, CLAUDE_Z], 'duck');
  for (let i = 0; i < 30; i++) {
    const t = T.oks + Math.floor(i / 4) * T.okStep + (i % 4) * 0.06;
    add(P.ok(i), t, [-2.0 + rand() * 3.9, 5.5 + rand(), -1.2 + rand() * 2.7], 'ok');
  }
  add(P.weight(), T.weight, [-0.2, 6, 0.4], 'weight', 6);
  // Три двери вырастают из пола — они не падают, а сразу стоят на месте.
  const doors = [-0.15, 0.6, 1.35].map((x, i) => {
    const d = P.door(i + 1); d.position.set(x, 0, -1.55); pile.add(d); return d;
  });
  const statics = [
    { t: T.hourglass, pos: [-1.85, 0.65, 0.9], half: [0.4, 0.65, 0.4] },
    ...doors.map((d, i) => ({ t: T.doorsGrow[i] + T.doorGrowDur, pos: [d.position.x, 0.55, -1.55], half: [0.35, 0.55, 0.08] })),
  ];
  const sim = simulate({ items, statics, colliders: R.colliders, rand });

  // Финальные позы кучи: из них же предметы «собираются обратно» в кульминации.
  const qTmp = new THREE.Quaternion(), pTmp = new THREE.Vector3();
  const endPose = items.map((_, i) => { const p = new THREE.Vector3(), q = new THREE.Quaternion(); poseAt(sim, i, T.simEnd + 0.45, p, q); return { p, q }; });
  items.forEach((it, i) => { it.obj.position.copy(endPose[i].p); it.obj.quaternion.copy(endPose[i].q); });
  const pileTop = new THREE.Box3().setFromObject(pile).max.y;
  const impactOf = kind => sim.impacts.filter(m => items[m.i].kind === kind).map(m => m.t);
  const bulb3Hit = sim.impacts.find(m => m.i === 4)?.t ?? 18.2;
  const duckHit = impactOf('duck')[0] ?? 26.4;

  // Обратная сборка: от последнего предмета к первому, из кубика «Краткое содержание».
  const flights = [];
  {
    const order = [...items.map((it, i) => ({ obj: it.obj, kind: it.kind, i })), ...doors.map((obj, d) => ({ obj, kind: 'door', d }))]
      .sort((a, b) => (b.kind === 'door' ? 19.7 + b.d * 0.01 : items[b.i].t) - (a.kind === 'door' ? 19.7 + a.d * 0.01 : items[a.i].t));
    let at = T.burst + 0.2;
    const r2 = rng(7);
    for (const o of order) {
      const axis = V(r2() - 0.5, r2() - 0.5, r2() - 0.5).normalize();
      const end = o.kind === 'door' ? { p: o.obj.position.clone(), q: new THREE.Quaternion() } : endPose[o.i];
      flights.push({ ...o, at, end, axis });
      at += o.kind === 'ok' ? 0.07 : 0.3;
    }
  }

  // Рекурсия: за дверью 1 — эта же комната.
  const portalRT = new THREE.WebGLRenderTarget(256, 512, { samples: 4 });
  const portalCam = new THREE.PerspectiveCamera(40, 0.5, 0.1, 100);
  const portalMat = new THREE.MeshBasicMaterial({ map: portalRT.texture });
  const portalOff = doors[0].userData.portal.material;

  // ---------- Финал: ноутбук на тёмном столе ----------
  const desk = new THREE.Scene(); desk.background = new THREE.Color(0x07080D);
  desk.add(new THREE.HemisphereLight(0x5A6B9A, 0x0B0B10, 0.5));
  const moon = new THREE.DirectionalLight(0x8FA6E8, 0.9); moon.position.set(-6, 7, 3);
  softShadow(moon, 4096, 4); Object.assign(moon.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); desk.add(moon);
  const glow = new THREE.PointLight(0xCFE0FF, 6, 0, 2); glow.position.set(0, 1.4, 0.4); desk.add(glow);
  const deskLamp = new THREE.SpotLight(0xFFC78A, 40, 0, 0.6, 0.6, 2); deskLamp.position.set(3.6, 4.2, 1.5); deskLamp.target.position.set(1.8, 0, 0.8);
  softShadow(deskLamp, 2048, 6); desk.add(deskLamp, deskLamp.target);
  box(12, 0.3, 7, 0x3B2A20, 0, -0.15, 0, desk, 0.05);
  box(3.2, 0.12, 2.2, C.metalDark, 0, 0.06, 0, desk, 0.04);
  box(2.9, 0.01, 1.1, C.bezel, 0, 0.125, 0.15, desk, 0.005);
  const SCREEN = { w: 3.0, h: 1.875, tilt: -0.2 };
  const lid = pivot(desk, 0, 0.12, -1.08); lid.rotation.x = SCREEN.tilt;
  box(3.2, 2.08, 0.08, C.bezel, 0, 1.04, 0, lid, 0.03);
  const screenRT = new THREE.WebGLRenderTarget(3072, 1920, { samples: 4, type: THREE.HalfFloatType });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), new THREE.MeshBasicMaterial({ map: screenRT.texture }));
  screen.position.set(0, 1.04, 0.042); lid.add(screen);
  const screenCam = new THREE.PerspectiveCamera(40, 1.6, 0.1, 100);
  screenCam.position.copy(WIDE[0]); screenCam.lookAt(WIDE[1]);
  const H2 = P.hourglass(); H2.scale.setScalar(1.25); H2.position.set(-1.25, 0, 1.45); H2.rotation.y = 0.5; H2.userData.setSand(1); desk.add(H2);
  const D2 = P.duck(); D2.scale.setScalar(1.1); D2.position.set(1.2, 0, 1.5); D2.rotation.y = -0.6; desk.add(D2);
  const deskCam = new THREE.PerspectiveCamera(40, width / height, 0.05, 100);
  // Стартовая точка: перпендикуляр к экрану на таком расстоянии, что экран по высоте = кадру. Срез совпадает с общим планом комнаты.
  lid.updateMatrixWorld(true);
  const sc = screen.getWorldPosition(V(0, 0, 0));
  const nrm = V(0, 0, 1).applyQuaternion(lid.getWorldQuaternion(new THREE.Quaternion()));
  const upS = V(0, 1, 0).applyQuaternion(lid.getWorldQuaternion(new THREE.Quaternion()));
  const d0 = SCREEN.h / (2 * Math.tan(THREE.MathUtils.degToRad(20)));
  const deskFrom = sc.clone().addScaledVector(nrm, d0), deskTo = V(0.4, 3.0, 9.6), deskLook = V(0, 0.9, 0);

  const pos = V(0, 0, 0), tgt = V(0, 0, 0), off = V(0, 0, 0);
  const shakes = [...sim.shakes, { t: T.press.hit, k: 1 }];
  let ctxDrawn = '';

  function setScene(tm) {
    // Комната, свет, сирена, индикатор.
    const alarm = tm >= T.alarm && tm < T.press.lift;
    siren.intensity = alarm && Math.floor(tm * 4) % 2 === 0 ? 40 : 0;
    lamp.intensity = alarm ? 15 : 45;
    R.sign.visible = tm >= T.alarm && tm < T.press.gone;
    const ctx = Math.round(contextAt(tm)), dim = ctx >= 97 && ctx < 100 && Math.floor(tm * 3) % 2 === 1;
    if (ctx + '' + dim !== ctxDrawn) { ctxDrawn = ctx + '' + dim; R.setContext(ctx, dim); }
    R.tick(tm);
    const doorAng = -1.3 * (smooth(span(tm, T.doorOpen, T.doorOpen + 0.4)) - smooth(span(tm, T.doorClose, T.doorClose + 0.4)));
    R.slab.rotation.y = doorAng;

    // Пресс и сплющивание.
    const py = plateY(tm), bottom = py - P.PRESS.half;
    PR.position.y = py; PR.visible = py < 8.4;
    const pressing = tm >= T.press.drop && tm < T.press.gone + 2.5;
    const spring = tm < T.press.lift ? 0.04 : 1 - 0.96 * Math.exp(-4 * (tm - T.press.lift)) * Math.cos(13 * (tm - T.press.lift));
    const squashBy = h => (pressing ? Math.min(Math.max(0.04, bottom / h), tm < T.press.lift ? 1 : spring) : 1);
    const widen = s => 1 + Math.max(0, 1 - s) * 0.5;

    // Песочные часы.
    H.visible = tm >= T.hourglass; H.scale.setScalar(popIn(tm, T.hourglass, 0.35)); H.userData.setSand(sandAt(tm));

    // Куча предметов.
    pile.visible = tm < T.swap || tm >= T.burst;
    pile.scale.y = tm < T.swap && pressing ? clamp01(bottom / pileTop) || 0.03 : 1;
    if (tm < T.burst) {
      items.forEach((it, i) => {
        it.obj.visible = tm >= it.t;
        if (!it.obj.visible) return;
        poseAt(sim, i, tm, it.obj.position, it.obj.quaternion);
        it.obj.scale.setScalar(popIn(tm, it.t, 0.25));
      });
      doors.forEach((d, i) => {
        const k = span(tm, T.doorsGrow[i], T.doorsGrow[i] + T.doorGrowDur);
        d.visible = k > 0; d.scale.set(1, easeOutBack(k), 1); d.quaternion.identity();
        d.userData.slab.rotation.y = 0;
      });
      const open = smooth(span(tm, T.portal[0], T.portal[0] + 0.35)) * (1 - span(tm, T.portal[1] - 0.15, T.portal[1]));
      doors[0].userData.slab.rotation.y = -1.7 * open;
      doors[0].userData.portal.material = open > 0.01 ? portalMat : portalOff;
      doors[0].userData.open = open;
    } else {
      for (const f of flights) {
        const k = span(tm, f.at, f.at + 1.3), e = smooth(k);
        f.obj.visible = k > 0;
        if (!f.obj.visible) continue;
        const from = S.position;
        f.obj.position.lerpVectors(from, f.end.p, e); f.obj.position.y += Math.sin(Math.PI * e) * 1.5 + (1 - e) * 0.25;
        qTmp.setFromAxisAngle(f.axis, (1 - e) * 5);
        f.obj.quaternion.copy(f.end.q).multiply(qTmp);
        f.obj.scale.setScalar(lerp(0.15, 1, e));
        if (f.kind === 'door') { f.obj.userData.slab.rotation.y = 0; f.obj.userData.portal.material = portalOff; }
      }
      doors[0].userData.open = 0;
    }

    // Ты: вход через дверь, походка, жесты.
    Ty.ty.visible = tm >= T.doorOpen + 0.1;
    const wk = span(tm, ...T.tyWalk), walking = wk > 0 && wk < 1;
    Ty.ty.position.set(lerp(TY_DOOR[0], TY_HOME[0], smooth(wk)), walking ? Math.abs(Math.sin(tm * 10)) * 0.05 : 0, lerp(TY_DOOR[1], TY_HOME[1], smooth(wk)));
    const walkDir = Math.atan2(TY_HOME[0] - TY_DOOR[0], TY_HOME[1] - TY_DOOR[1]);
    Ty.ty.rotation.y = lerp(walkDir, -0.25, smooth(span(tm, T.tyWalk[1] - 0.2, T.tyWalk[1] + 0.4)));
    Ty.legs.forEach((l, i) => l.rotation.x = walking ? Math.sin(tm * 10 + i * Math.PI) * 0.5 : 0);
    const tyS = squashBy(3.45); Ty.ty.scale.set(widen(tyS), tyS, widen(tyS));

    const bam = tm >= T.press.lift ? Math.max(0, 1 - (tm - T.press.lift) * 0.4) : 0;
    const puff = tm >= T.puff ? Math.max(0, 1 - (tm - T.puff) * 1.2) : 0;
    const pop = bam * bam, wob = Math.sin((1 - bam) * 22) * bam * 0.25;
    Ty.sides.forEach((p, i) => { const s = i ? 1 : -1; p.rotation.z = s * (pop * 1.1 + wob + 0.02 * Math.sin(tm * 1.5)); });
    Ty.locks.forEach((p, i) => { const s = i ? 1 : -1; p.rotation.z = s * (pop * 0.9 + wob); });
    Ty.ants.forEach(a => a.scale.y = 1 + pop * 2.5);
    Ty.strand.rotation.z = 0.12 + Math.sin(puff * Math.PI) * 2.2 + wob * 2 + (walking ? Math.sin(tm * 10) * 0.1 : 0);
    Ty.head.position.y = 2.5 + 0.012 * Math.sin(tm * 2);
    const lookUp = smooth(span(tm, T.press.drop - 0.3, T.press.drop + 0.2)) * (1 - smooth(span(tm, T.press.lift, T.press.lift + 0.5)));
    Ty.head.rotation.x = -Math.sin(puff * Math.PI) * 0.12 - lookUp * 0.35;
    Ty.head.rotation.y = smooth(span(tm, 15.4, 15.8)) * (1 - smooth(span(tm, 18.2, 18.6))) * 0.35;
    Ty.lids.forEach(l => l.scale.y = blinking(tm) ? 2.2 : 1);
    Ty.mouth.scale.y = talking('ty', tm) ? 1 + 2.5 * Math.abs(Math.sin(tm * 17)) : 1;
    // Рука: карман → уточка у груди.
    const reach = smooth(span(tm, ...T.pocket)), show = smooth(span(tm, ...T.showDuck));
    Ty.arms.forEach((a, i) => {
      const s = i ? 1 : -1, sw = walking ? -Math.sin(tm * 10 + i * Math.PI) * 0.35 : 0;
      a.rotation.set(sw, 0, s * (0.04 + 0.02 * Math.sin(tm * 2)));
    });
    if (reach > 0) {
      Ty.arms[0].rotation.x = lerp(-0.35 * reach, -1.25, show);
      Ty.arms[0].rotation.z = lerp(lerp(-0.04, 0.55, reach), 0.3, show);
    }
    handDuck.visible = tm >= T.pocket[1] - 0.15;
    const sq = pulse(tm, T.squeeze, 10, 5);
    handDuck.scale.set(0.55 * (1 + Math.max(0, sq) * 0.25), 0.55 * (1 - Math.max(0, sq) * 0.4), 0.55);
    handDuck.rotation.set(1.25 * show, -0.4, 0);

    // Claude.
    const cs = Math.min(claudeBaseSY(tm), squashBy(1.02));
    const dodge = span(tm, ...T.dodge);
    K.g.position.set(claudeX(tm), Math.sin(Math.PI * dodge) * 0.35, CLAUDE_Z);
    K.g.rotation.y = 0.3;
    K.g.scale.set(widen(cs), cs, widen(cs));
    const hit = -0.25 * pulse(tm, bulb3Hit) - 0.3 * pulse(tm, duckHit, 14, 5);
    const talk = talking('claude', tm) ? 0.05 * Math.abs(Math.sin(tm * 16)) : 0;
    const happy = tm > 44 && tm < 48.6 ? 0.04 * Math.abs(Math.sin(tm * 6)) : 0;
    K.body.scale.set(1 - hit * 0.5, 1 + hit + talk + happy + 0.03 * Math.sin(tm * 3), 1 - hit * 0.5);
    const sway = tm < T.tyWalk[1] ? 0.1 * Math.sin(tm * 2.4) : 0;
    const dust = tm > 12.7 && tm < 13.5 ? 0.15 * Math.sin(tm * 30) * Math.sin(Math.PI * span(tm, 12.7, 13.5)) : 0;
    K.body.rotation.z = sway + dust;
    let eyeY = 1, eyeUp = 0;
    if (tm >= T.alarm - 0.1 && tm < T.press.lift) { eyeY = 1.4; eyeUp = 0.03; }
    if (tm > 44 && tm < 48.6) eyeY = 0.4;
    if (tm > 54.6 && tm < 57) eyeY = 0.7;
    const flash = tm >= T.flash ? Math.exp(-(tm - T.flash) * 3) : 0;
    if (flash > 0.05) eyeY = 1.4;
    if (blinking(tm + 0.7)) eyeY = 0.15;
    K.eyes.forEach(e => { e.scale.y = eyeY; e.position.y = 0.45 + eyeUp; });
    K.eyeMat.emissiveIntensity = flash * 4;

    // Кубик «Краткое содержание».
    S.visible = tm >= T.swap;
    const floor = V(0.65, 0, 1.45), held = V(claudeX(tm), 1.08, 1.05), dropTo = V(0.05, 0, 1.55);
    const lk = smooth(span(tm, ...T.lift));
    S.position.lerpVectors(floor, held, lk); S.position.y += Math.sin(Math.PI * lk) * 0.3;
    S.rotation.set(0, lerp(-0.2, 0, lk), 0);
    if (tm >= T.lift[1] && tm < T.burst) S.position.y += 0.02 * Math.sin(tm * 3);
    S.rotation.y += smooth(span(tm, ...T.spin)) * Math.PI * 2;
    S.rotation.x = Math.sin(Math.PI * span(tm, ...T.spin)) * 0.4;
    if (tm >= T.crack[0] && tm < T.crack[1]) { S.position.x += 0.025 * Math.sin(tm * 90); S.rotation.z = 0.06 * Math.sin(tm * 70); }
    if (tm >= T.burst) {
      const fk = span(tm, T.burst, T.burst + 0.45);
      S.position.lerpVectors(held, dropTo, fk); S.position.y = lerp(held.y, 0, fk * fk) + Math.max(0, pulse(tm, T.burst + 0.45, 18, 7)) * 0.08;
      S.rotation.set(0, 0, 0);
    }
    const ss = tm < T.press.gone + 2.5 ? squashBy(0.45) : 1;
    S.scale.set(widen(ss), ss, widen(ss));
    S.userData.setNote(span(tm, ...T.write));
  }

  const roomFx = composerFor(scene, cam), deskFx = composerFor(desk, deskCam);

  function render(t) {
    const tm = sceneTime(t);
    setScene(tm);
    if (t >= T.desk) {
      // Комната — на экране ноутбука; камера отъезжает от экрана в ночь.
      renderer.setRenderTarget(screenRT); renderer.render(scene, screenCam); renderer.setRenderTarget(null);
      const k = smooth(span(t, T.desk + 0.1, 71.2));
      deskCam.position.lerpVectors(deskFrom, deskTo, k);
      deskCam.up.lerpVectors(upS, V(0, 1, 0), k).normalize();
      deskCam.lookAt(pTmp.lerpVectors(sc, deskLook, k));
      deskFx.render();
      return;
    }
    camAt(t, pos, tgt);
    let sh = 0;
    for (const s of shakes) if (tm >= s.t && tm < s.t + 1.5) sh += s.k * Math.exp(-(tm - s.t) * 4);
    off.set(Math.sin(t * 61) * 0.15 * sh, Math.sin(t * 47) * 0.12 * sh, 0);
    cam.position.copy(pos).add(off); cam.up.set(0, 1, 0); cam.lookAt(tgt.clone().add(off));
    if (doors[0].userData.open > 0.01) {
      const pm = doors[0].userData.portal;
      pm.visible = false;
      portalCam.position.copy(WIDE[0]); portalCam.lookAt(WIDE[1]);
      renderer.setRenderTarget(portalRT); renderer.render(scene, portalCam); renderer.setRenderTarget(null);
      pm.visible = true;
    }
    roomFx.render();
  }

  // Звуковые события, привязанные к физике: первый удар каждого предмета.
  const impacts = sim.impacts.map(m => ({ t: m.t, kind: items[m.i].kind, v: m.v, i: m.i }));
  return { render, impacts, debug: { items, doors, endPose, sim, poseAt }, setSize: (w, h) => { renderer.setSize(w, h, false); roomFx.setSize(w, h); deskFx.setSize(w, h); cam.aspect = deskCam.aspect = w / h; cam.updateProjectionMatrix(); deskCam.updateProjectionMatrix(); } };
}
