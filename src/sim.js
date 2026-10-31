import * as CANNON from 'cannon-es';
import { physBox } from './props.js';
import { T, claudeX, claudeBaseSY, CLAUDE_Z, TY_HOME } from './timeline.js';

// Физика просчитывается один раз целиком (шаг 1/60, фиксированный seed) и запоминается по шагам.
// Дальше любой кадр — просто чтение из таблицы, поэтому Remotion может рендерить кадры в любом порядке.
export const SIM_DT = 1 / 60;
export const SIM_START = 3;

// items: [{ obj, t, pos, rot, spin, massK }], statics: [{ t, pos, half }]
export function simulate({ items, statics, colliders, rand }) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.defaultContactMaterial.friction = 0.45;
  world.defaultContactMaterial.restitution = 0.12;
  world.allowSleep = true;
  const addStatic = (pos, half) => {
    const b = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(...half)) });
    b.position.set(...pos); world.addBody(b);
  };
  colliders.forEach(c => addStatic(c.pos, c.half));
  const pendingStatics = [
    { t: T.tyWalk[1], pos: [TY_HOME[0], 1.72, TY_HOME[1]], half: [0.62, 1.72, 0.4] },
    ...statics,
  ].sort((a, b) => a.t - b.t);

  const claudeShape = new CANNON.Box(new CANNON.Vec3(0.55, 0.51, 0.4));
  const claude = new CANNON.Body({ type: CANNON.Body.KINEMATIC, mass: 0, shape: claudeShape });
  world.addBody(claude);
  function placeClaude(t) {
    const sy = claudeBaseSY(t), xz = 1 + (1 - sy) * 0.5;
    claudeShape.halfExtents.set(0.5 * xz, 0.51 * sy, 0.38 * xz);
    claudeShape.updateConvexPolyhedronRepresentation(); claudeShape.updateBoundingSphereRadius();
    claude.updateBoundingRadius(); claude.aabbNeedsUpdate = true;
    claude.position.set(claudeX(t), 0.51 * sy, CLAUDE_Z);
  }

  const bodies = items.map(it => {
    const { half, offset, volume } = physBox(it.obj);
    const body = new CANNON.Body({ mass: Math.max(0.2, volume * 6) * (it.massK ?? 1), sleepSpeedLimit: 0.15 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(half.x, half.y, half.z)), new CANNON.Vec3(offset.x, offset.y, offset.z));
    body.position.set(...it.pos);
    const r = [rand() * 0.8 - 0.4, rand() * 6.28, rand() * 0.8 - 0.4], w = [rand() * 4 - 2, rand() * 2 - 1, rand() * 4 - 2];
    // still: падает ровно, без закрутки (лампочка, которая должна встать Claude на голову).
    if (it.still != null) body.quaternion.setFromEuler(0, it.still, 0);
    else { body.quaternion.setFromEuler(...r); body.angularVelocity.set(...w); }
    return body;
  });

  const impacts = [];   // первый удар каждого предмета → звук
  const shakes = [];    // сильные удары тяжёлых предметов → тряска камеры
  let now = SIM_START;
  bodies.forEach((b, i) => b.addEventListener('collide', e => {
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (!b.hitOnce && v > 1.2) { b.hitOnce = true; impacts.push({ t: now, i, v }); }
    if ((items[i].massK ?? 1) > 1 && v > 3 && !shakes.some(s => Math.abs(s.t - now) < 0.3)) shakes.push({ t: now, k: Math.min(1, v / 8) });
  }));

  const steps = Math.ceil((T.simEnd + 0.5 - SIM_START) / SIM_DT);
  const track = bodies.map(() => new Float32Array(steps * 7));
  let ps = 0, spawned = 0;
  const order = items.map((_, i) => i).sort((a, b) => items[a].t - items[b].t);
  for (let s = 0; s < steps; s++) {
    now = SIM_START + s * SIM_DT;
    while (ps < pendingStatics.length && pendingStatics[ps].t <= now) { addStatic(pendingStatics[ps].pos, pendingStatics[ps].half); ps++; }
    while (spawned < order.length && items[order[spawned]].t <= now) { world.addBody(bodies[order[spawned]]); spawned++; }
    const before = claude.position.y;
    placeClaude(now);
    if (Math.abs(claude.position.y - before) > 1e-5 || (now > T.dodge[0] && now < T.dodge[1])) bodies.forEach(b => b.world && b.wakeUp());
    world.step(SIM_DT);
    bodies.forEach((b, i) => {
      const o = s * 7, a = track[i];
      a[o] = b.position.x; a[o + 1] = b.position.y; a[o + 2] = b.position.z;
      a[o + 3] = b.quaternion.x; a[o + 4] = b.quaternion.y; a[o + 5] = b.quaternion.z; a[o + 6] = b.quaternion.w;
    });
  }
  return { track, steps, impacts, shakes };
}

// Поза предмета i в момент tm (линейная интерполяция между шагами).
export function poseAt(sim, i, tm, outPos, outQuat) {
  const f = Math.min(sim.steps - 1.001, Math.max(0, (tm - SIM_START) / SIM_DT));
  const s = Math.floor(f), k = f - s, a = sim.track[i], o = s * 7, n = o + 7;
  outPos.set(a[o] + (a[n] - a[o]) * k, a[o + 1] + (a[n + 1] - a[o + 1]) * k, a[o + 2] + (a[n + 2] - a[o + 2]) * k);
  outQuat.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]);
  const q2 = { x: a[n + 3], y: a[n + 4], z: a[n + 5], w: a[n + 6] };
  outQuat.slerp(new outQuat.constructor(q2.x, q2.y, q2.z, q2.w), k);
}
