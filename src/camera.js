import * as THREE from 'three';

/**
 * Cinematic 2.5D Camera Director ("LE THÉÂTRE DES OMBRES")
 *
 * Implements:
 * - Velocity-based look-ahead (horizontal & vertical)
 * - Dynamic Zone Framing (FOV, Z-distance, Y-offset, Pitch, Roll, Letterbox)
 * - Scripted Event Focus Cutaways (smooth pan/zoom to puzzle reveals, doors, or chandelier)
 * - Foreground Occlusion Management (fades foreground curtains/pillars blocking the player)
 * - Handheld organic breathing & Chase Dutch-angle + trauma shake
 */
export class CameraDirector {
  constructor(camera, domElements) {
    this.camera = camera;
    this.dom = domElements;

    // Current smoothed state
    this.currentPos = new THREE.Vector3(0, 3.2, 11.5);
    this.lookAtTarget = new THREE.Vector3(0, 1.8, 0);
    this.currentFov = 38;
    this.currentRoll = 0;

    // Velocity look-ahead smoothing
    this.lookAheadX = 0;
    this.lookAheadY = 0;

    // Trauma / Camera Shake (0..1)
    this.trauma = 0;
    this.elapsedTime = 0;

    // Cutaway / Event Focus Override
    this.focusOverride = null; // { pos, target, fov, roll, duration, timer, label, letterbox }

    // Camera Zones across the 4 Acts of the Theater
    this.zones = [
      {
        name: 'Act I: 奈落の衣装部屋 (狭い地下通路)',
        lensLabel: '50mm — 閉塞クローズショット',
        minX: -12,
        maxX: 11.5,
        distZ: 8.6,
        offsetY: 1.55,
        targetOffsetY: 1.05,
        fov: 32,
        roll: 0,
        lookAheadScale: 1.1,
        letterbox: false
      },
      {
        name: 'Act I: 奈落の昇降機縦坑',
        lensLabel: '35mm — 縦坑あおり構図',
        minX: 11.5,
        maxX: 25.0,
        distZ: 12.2,
        offsetY: 2.3,
        targetOffsetY: 1.5,
        fov: 40,
        roll: 0,
        lookAheadScale: 1.35,
        letterbox: false
      },
      {
        name: 'Act II: 大舞台プロセニアム (パノラマ構図)',
        lensLabel: '24mm — 大舞台ワイドシネマ',
        minX: 25.0,
        maxX: 54.5,
        distZ: 16.4,
        offsetY: 3.1,
        targetOffsetY: 1.85,
        fov: 45,
        roll: 0,
        lookAheadScale: 1.9,
        letterbox: true
      },
      {
        name: 'Act II: 舞台袖・奈落の歯車室',
        lensLabel: '40mm — 舞台裏ミディアム',
        minX: 54.5,
        maxX: 67.5,
        distZ: 10.4,
        offsetY: 2.1,
        targetOffsetY: 1.3,
        fov: 36,
        roll: 0,
        lookAheadScale: 1.3,
        letterbox: false
      },
      {
        name: 'Act III: 照明桟橋の追跡 (ダッチアングル)',
        lensLabel: '28mm — 追跡ダイナミック・チルト',
        minX: 67.5,
        maxX: 103.5,
        distZ: 13.8,
        offsetY: 2.4,
        targetOffsetY: 1.55,
        fov: 46,
        roll: -0.038, // Slight tense Dutch tilt during the catwalk chase
        lookAheadScale: 2.6, // Aggressive forward look-ahead so obstacles ahead are clearly visible
        letterbox: true
      },
      {
        name: 'Act IV: 大シャンデリアと正面ロビー (クライマックス)',
        lensLabel: '21mm — 終幕ドラマティック広角',
        minX: 103.5,
        maxX: 145.0,
        distZ: 15.8,
        offsetY: 2.9,
        targetOffsetY: 1.8,
        fov: 44,
        roll: 0,
        lookAheadScale: 1.7,
        letterbox: false
      }
    ];

    this.activeZone = this.zones[0];
  }

  /**
   * Trigger a cinematic focus cutaway (e.g., showing a gate opening, the Maestro awakening, or chandelier falling)
   */
  triggerFocus({
    pos,
    target,
    fov = 34,
    roll = 0,
    duration = 2.6,
    label = '85mm — 演出フォーカス',
    letterbox = true
  }) {
    this.focusOverride = {
      pos: pos.clone(),
      target: target.clone(),
      fov,
      roll,
      duration,
      timer: duration,
      label,
      letterbox
    };
  }

  addTrauma(amount) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  getZoneForX(x) {
    for (const z of this.zones) {
      if (x >= z.minX && x < z.maxX) return z;
    }
    return this.zones[this.zones.length - 1];
  }

  update(dt, player, foregroundOccluders = [], isChasing = false) {
    this.elapsedTime += dt;
    this.trauma = Math.max(0, this.trauma - dt * 0.85);

    const zone = this.getZoneForX(player.pos.x);
    this.activeZone = zone;

    let desiredPos = new THREE.Vector3();
    let desiredTarget = new THREE.Vector3();
    let desiredFov = zone.fov;
    let desiredRoll = zone.roll;
    let lensText = zone.lensLabel;
    let showLetterbox = zone.letterbox;

    if (this.focusOverride) {
      this.focusOverride.timer -= dt;
      desiredPos.copy(this.focusOverride.pos);
      desiredTarget.copy(this.focusOverride.target);
      desiredFov = this.focusOverride.fov;
      desiredRoll = this.focusOverride.roll;
      lensText = this.focusOverride.label;
      showLetterbox = this.focusOverride.letterbox;

      if (this.focusOverride.timer <= 0) {
        this.focusOverride = null;
      }
    } else {
      // Compute velocity look-ahead
      const targetLeadX = isChasing
        ? Math.max(2.2, player.vel.x * 0.55) // During chase, always bias camera ahead to the right
        : player.vel.x * 0.35 * zone.lookAheadScale + player.facing * 0.85;

      const targetLeadY = player.vel.y * 0.14;

      this.lookAheadX = THREE.MathUtils.lerp(this.lookAheadX, targetLeadX, Math.min(1, dt * 3.5));
      this.lookAheadY = THREE.MathUtils.lerp(this.lookAheadY, targetLeadY, Math.min(1, dt * 4.0));

      // Subtle crouch zoom-in when player hides in shadows
      const crouchZoom = player.isCrouching ? -1.4 : 0;
      const chaseZoom = isChasing ? -0.8 : 0;

      desiredPos.set(
        player.pos.x + this.lookAheadX * 0.75,
        player.pos.y + zone.offsetY + this.lookAheadY * 0.5,
        zone.distZ + crouchZoom + chaseZoom
      );

      desiredTarget.set(
        player.pos.x + this.lookAheadX,
        player.pos.y + zone.targetOffsetY + this.lookAheadY * 0.35,
        0
      );

      if (isChasing) {
        desiredRoll = -0.045 + Math.sin(this.elapsedTime * 5.5) * 0.015;
        desiredFov = zone.fov + 4;
        lensText = '24mm — 緊急追跡カメラ';
        showLetterbox = true;
      } else if (player.isHiddenInShadow) {
        desiredFov = zone.fov - 4;
        lensText = '50mm — 潜伏ローキー';
      }
    }

    // Smoothly damp camera position, lookAt target, FOV, and roll
    const posLerp = this.focusOverride ? 4.2 : 4.8;
    this.currentPos.lerp(desiredPos, Math.min(1, dt * posLerp));
    this.lookAtTarget.lerp(desiredTarget, Math.min(1, dt * (posLerp + 1.2)));
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, desiredFov, Math.min(1, dt * 3.8));
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, desiredRoll, Math.min(1, dt * 4.0));

    // Organic handheld breathing + trauma shake
    const breathX = Math.sin(this.elapsedTime * 1.3) * 0.045;
    const breathY = Math.cos(this.elapsedTime * 1.9) * 0.035;

    const shakePower = this.trauma * this.trauma * 0.55;
    const shakeX = (Math.random() - 0.5) * 2 * shakePower;
    const shakeY = (Math.random() - 0.5) * 2 * shakePower;
    const shakeRoll = (Math.random() - 0.5) * 0.08 * shakePower;

    this.camera.position.set(
      this.currentPos.x + breathX + shakeX,
      this.currentPos.y + breathY + shakeY,
      this.currentPos.z
    );

    this.camera.lookAt(this.lookAtTarget);
    this.camera.rotation.z += this.currentRoll + shakeRoll;

    if (Math.abs(this.camera.fov - this.currentFov) > 0.02) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Update UI indicators
    if (this.dom.lensLabel && this.dom.lensLabel.textContent !== lensText) {
      this.dom.lensLabel.textContent = lensText;
    }
    if (showLetterbox) {
      document.body.classList.add('cinematic-bars');
    } else {
      document.body.classList.remove('cinematic-bars');
    }

    // Foreground Occlusion Fading: Ensure foreground curtains/archways never obscure the player
    for (const fg of foregroundOccluders) {
      const distX = Math.abs(fg.x - player.pos.x);
      const targetOpacity = distX < fg.fadeRadius ? 0.16 : fg.baseOpacity;
      fg.material.opacity = THREE.MathUtils.lerp(fg.material.opacity, targetOpacity, Math.min(1, dt * 7));
    }
  }

  snapToPlayer(player) {
    const zone = this.getZoneForX(player.pos.x);
    this.currentPos.set(player.pos.x, player.pos.y + zone.offsetY, zone.distZ);
    this.lookAtTarget.set(player.pos.x, player.pos.y + zone.targetOffsetY, 0);
    this.currentFov = zone.fov;
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.lookAtTarget);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }
}
