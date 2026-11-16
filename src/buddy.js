import * as THREE from 'three';
import { LOOP_LENGTH, MPH, wrapS, loopDelta, laneWidthAt } from './config.js';
import { posAt, headingAt, latForLane, usableLanesAt, distanceScaleAt, elevAt } from './road.js';
import { makePlayerLexusES } from './player.js';
import { addNpcBlinkers, contactShadow } from './vehicles.js';

// A deliberately separate driver: it never enters Traffic.npcs, so it cannot
// change density, collision selection, recycling, or any existing NPC state.
export class BuddyDriver {
  constructor(scene, player, traffic) {
    this.scene = scene;
    this.player = player;
    this.traffic = traffic;
    this.active = false;
    this.s = 0;
    this.dir = player.dir;
    this.lane = 1;
    this.laneFloat = 1;
    this.v = 0;
    this.laneT = 0;
    this.signalDir = 0;
    this.decisionT = 0;
    this.wiggleT = 0;
    this.group = makePlayerLexusES();
    this.group.add(contactShadow(4.95, 1.88));
    this.blink = addNpcBlinkers(this.group, { L: 4.95, W: 1.88 });
    this.group.visible = false;
    scene.add(this.group);
  }

  toggle() {
    this.active = !this.active;
    if (this.active) {
      this.dir = this.player.dir;
      this.s = wrapS(this.player.s + this.dir * 62 / distanceScaleAt(this.player.s));
      this.lane = this.laneFloat = Math.max(0, Math.min(usableLanesAt(this.s) - 1, 1));
      this.v = Math.max(70 * MPH, Math.min(82 * MPH, this.player.v + 1.5));
      this.wiggleT = 0;
      this.decisionT = 0;
      this.signalDir = 0;
      this.group.visible = true;
    } else {
      this.group.visible = false;
    }
    return this.active;
  }

  _leader(s, lane, dir = this.dir) {
    let best = null;
    for (const npc of this.traffic.npcs) {
      if (!npc.active || !npc.group || npc.dir !== dir) continue;
      if (Math.abs(npc.laneFloat - lane) > 0.7) continue;
      const gap = loopDelta(s, npc.s) * dir;
      if (gap > 0 && (!best || gap < best.gap)) best = { gap, v: npc.v, ref: npc };
    }
    const playerLane = this.player.laneFloat ?? this.player.lane ?? 1;
    if (this.player.dir === dir && Math.abs(playerLane - lane) <= 0.7) {
      const gap = loopDelta(s, this.player.s) * dir;
      if (gap > 0 && (!best || gap < best.gap)) best = { gap, v: this.player.v, ref: this.player };
    }
    return best;
  }

  _gapAhead(s, lane, dir = this.dir) {
    return this._leader(s, lane, dir)?.gap ?? Infinity;
  }

  _gapBehind(s, lane, dir = this.dir) {
    let best = Infinity;
    for (const npc of this.traffic.npcs) {
      if (!npc.active || !npc.group || npc.dir !== dir) continue;
      if (Math.abs(npc.laneFloat - lane) > 0.7) continue;
      const gap = loopDelta(npc.s, s) * dir;
      if (gap > 0 && gap < best) best = gap;
    }
    const playerLane = this.player.laneFloat ?? this.player.lane ?? 1;
    if (this.player.dir === dir && Math.abs(playerLane - lane) <= 0.7) {
      const gap = loopDelta(this.player.s, s) * dir;
      if (gap > 0 && gap < best) best = gap;
    }
    return best;
  }

  _chooseLane() {
    const count = usableLanesAt(this.s);
    if (this.laneT > 0 || this.decisionT > 0) return;
    this.lane = Math.max(0, Math.min(count - 1, this.lane));
    const currentGap = this._gapAhead(this.s, this.lane);
    const blocked = currentGap < Math.max(72, this.v * 2.1);
    if (blocked) {
      const choices = [this.lane - 1, this.lane + 1]
        .filter(lane => lane >= 0 && lane < count)
        .map(lane => ({ lane, ahead: this._gapAhead(this.s, lane), behind: this._gapBehind(this.s, lane) }))
        .filter(c => c.ahead > Math.max(32, this.v * 1.05) && c.behind > Math.max(26, this.v * 0.85))
        .sort((a, b) => (b.ahead - a.ahead) || (a.lane - b.lane));
      if (choices[0] && choices[0].ahead > currentGap + 28) {
        this.signalDir = Math.sign(choices[0].lane - this.lane);
        this.lane = choices[0].lane;
        this.laneT = 2.1;
        this.decisionT = 2.8;
      }
    } else if (this.lane < count - 1 && this._gapAhead(this.s, this.lane + 1) > 150
        && this._gapBehind(this.s, this.lane + 1) > 60) {
      // Settle back toward a normal cruising lane once the pass is complete.
      this.signalDir = 1;
      this.lane += 1;
      this.laneT = 2.2;
      this.decisionT = 4.0;
    }
  }

  _trafficFlow() {
    let sum = 0, weight = 0;
    for (const npc of this.traffic.npcs) {
      if (!npc.active || !npc.group || npc.dir !== this.dir) continue;
      const d = Math.abs(loopDelta(this.s, npc.s));
      if (d > 260) continue;
      const w = 1 - d / 300;
      sum += npc.v * w; weight += w;
    }
    return weight > 0 ? sum / weight : this.player.v;
  }

  update(dt) {
    if (!this.active) return;
    if (this.dir !== this.player.dir) {
      this.dir = this.player.dir;
      this.s = wrapS(this.player.s + this.dir * 58 / distanceScaleAt(this.player.s));
      this.v = Math.max(65 * MPH, Math.min(80 * MPH, this.player.v));
      this.lane = this.laneFloat = Math.max(0, Math.min(usableLanesAt(this.s) - 1, this.player.lane ?? 1));
    }
    this.laneT -= dt;
    this.decisionT -= dt;
    this.wiggleT += dt;
    this._chooseLane();
    const leader = this._leader(this.s, this.lane);
    const flow = this._trafficFlow();
    const leadFromPlayer = loopDelta(this.player.s, this.s) * this.dir;
    let target = Math.max(70 * MPH, Math.min(90 * MPH, flow * 0.58 + this.player.v * 0.42 + 1.0));
    // Convoy logic: being slightly ahead is fine, but the buddy never treats
    // opening a giant gap as winning. It eases back or catches up smoothly.
    if (leadFromPlayer > 135) target = Math.min(target, Math.max(45 * MPH, this.player.v - 1.8));
    else if (leadFromPlayer > 90) target = Math.min(target, this.player.v + 0.2);
    else if (leadFromPlayer < -90) target = Math.min(90 * MPH, Math.max(target, this.player.v + 3.0));
    else if (leadFromPlayer < 15) target = Math.min(90 * MPH, Math.max(target, this.player.v + 1.5));
    if (leader) {
      const safe = Math.max(18, this.v * 1.25);
      if (leader.gap < safe * 2.2) {
        const closingAllowance = Math.max(-8, Math.min(3, (leader.gap - safe) * 0.12));
        target = Math.min(target, Math.max(18 * MPH, leader.v + closingAllowance));
      }
    }
    const accel = target > this.v ? 2.6 : 4.2;
    this.v += Math.sign(target - this.v) * Math.min(Math.abs(target - this.v), accel * dt);
    this.v = Math.max(15 * MPH, Math.min(90 * MPH, this.v));
    this.s = wrapS(this.s + this.dir * this.v * dt / distanceScaleAt(this.s));
    const laneStep = Math.min(Math.abs(this.lane - this.laneFloat), 0.8 * dt) * Math.sign(this.lane - this.laneFloat);
    this.laneFloat += laneStep;
    const lat = latForLane(this.dir, this.laneFloat, this.s);
    posAt(this.s, lat, this.group.position);
    this.group.position.y = elevAt(this.s);
    this.group.rotation.y = headingAt(this.s) + (this.dir > 0 ? 0 : Math.PI) + Math.atan2(-laneStep * laneWidthAt(this.s), Math.max(this.v, 8));
    const wheels = this.group.userData.wheels;
    if (wheels) for (const wheel of wheels) wheel.rotation.x += (this.v / wheel.userData.r) * dt;
    if (this.blink) {
      const blinking = this.laneT > 0 && (this.wiggleT % 0.8) < 0.4;
      this.blink.matL.emissiveIntensity = blinking && this.signalDir < 0 ? 2.5 : 0;
      this.blink.matR.emissiveIntensity = blinking && this.signalDir > 0 ? 2.5 : 0;
      if (this.laneT <= 0) this.signalDir = 0;
    }
  }

  get mph() { return this.v / MPH; }
}
