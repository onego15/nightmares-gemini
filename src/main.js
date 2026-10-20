import * as THREE from 'three';
import { SoundManager } from './audio.js';
import { CameraDirector } from './camera.js';
import { Player } from './player.js';
import { TheaterWorld } from './world.js';

class TheaterEscapeGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.dom = {
      titleScreen: document.getElementById('title-screen'),
      endingScreen: document.getElementById('ending-screen'),
      helpModal: document.getElementById('help-modal'),
      caughtOverlay: document.getElementById('caught-overlay'),
      dangerVignette: document.getElementById('danger-vignette'),
      worldPrompt: document.getElementById('world-prompt'),
      promptKey: document.getElementById('prompt-key-text'),
      promptLabel: document.getElementById('prompt-label-text'),
      chapterBanner: document.getElementById('chapter-banner'),
      chapterSub: document.getElementById('chapter-sub'),
      chapterMain: document.getElementById('chapter-main'),
      subtitleBox: document.getElementById('subtitle-box'),
      subtitleText: document.getElementById('subtitle-text'),
      topHud: document.getElementById('top-hud'),
      controlsBar: document.getElementById('controls-bar'),
      lensLabel: document.getElementById('cam-lens-label'),
      keyInventory: document.getElementById('key-inventory'),
      endingStats: document.getElementById('ending-stats')
    };

    this.state = 'title'; // 'title' | 'playing' | 'paused' | 'dying' | 'ending'
    this.currentAct = 1;
    this.highestActVisited = 0;
    this.deaths = 0;
    this.startTime = 0;
    this.subtitleTimer = 0;
    this.bannerTimer = 0;

    this.input = {
      left: false,
      right: false,
      sprint: false,
      crouch: false,
      jumpPressed: false,
      jumpHeld: false,
      interact: false,
      interactPressed: false
    };

    this.initRenderer();
    this.sound = new SoundManager();
    this.cameraDirector = new CameraDirector(this.camera, this.dom);
    this.world = new TheaterWorld(this.scene, this.sound, this.cameraDirector);
    this.player = new Player(this.scene, this.sound);

    this.bindEvents();
    this.cameraDirector.snapToPlayer(this.player);

    // Expose hook for automated Playwright inspection & demo recording
    window.__game = this;

    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      38,
      window.innerWidth / window.innerHeight,
      0.1,
      120
    );
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.sprint = true;
      if (code === 'KeyC' || code === 'KeyS' || code === 'ArrowDown') this.input.crouch = true;
      if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
        this.input.jumpPressed = true;
        this.input.jumpHeld = true;
      }
      if (code === 'KeyE' || code === 'Enter') {
        this.input.interact = true;
        this.input.interactPressed = true;
      }
      if (code === 'KeyH' || code === 'Escape') {
        if (this.state === 'playing') this.togglePause(true);
        else if (this.state === 'paused') this.togglePause(false);
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.sprint = false;
      if (code === 'KeyC' || code === 'KeyS' || code === 'ArrowDown') this.input.crouch = false;
      if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
        this.input.jumpHeld = false;
        this.input.jumpPressed = false;
      }
      if (code === 'KeyE' || code === 'Enter') {
        this.input.interact = false;
        this.input.interactPressed = false;
      }
    });

    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.startGame(1);
    });

    document.querySelectorAll('.scene-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = parseInt(btn.dataset.act, 10) || 1;
        this.startGame(act);
      });
    });

    document.getElementById('btn-help').addEventListener('click', () => {
      this.togglePause(true);
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
      this.togglePause(false);
    });

    document.getElementById('btn-restart-checkpoint').addEventListener('click', () => {
      this.togglePause(false);
      this.world.resetForCheckpoint(this.currentAct, this.player);
      this.cameraDirector.snapToPlayer(this.player);
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
      window.location.reload();
    });
  }

  startGame(actNumber = 1) {
    this.sound.resume();
    this.state = 'playing';
    this.startTime = performance.now();
    this.dom.titleScreen.classList.add('hidden');
    this.dom.endingScreen.classList.add('hidden');
    this.dom.topHud.classList.remove('hidden');
    this.dom.controlsBar.classList.remove('hidden');

    this.currentAct = actNumber;
    this.highestActVisited = actNumber - 1;
    this.world.resetForCheckpoint(actNumber, this.player);
    this.cameraDirector.snapToPlayer(this.player);
    this.checkActTransitions(true);
  }

  togglePause(pause) {
    if (pause) {
      this.state = 'paused';
      this.dom.helpModal.classList.remove('hidden');
    } else {
      this.state = 'playing';
      this.dom.helpModal.classList.add('hidden');
    }
  }

  showChapterBanner(sub, title) {
    this.dom.chapterSub.textContent = sub;
    this.dom.chapterMain.textContent = title;
    this.dom.chapterBanner.classList.remove('hidden');
    this.bannerTimer = 4.2;
  }

  showSubtitle(text, duration = 4.0) {
    this.dom.subtitleText.textContent = text;
    this.dom.subtitleBox.classList.remove('hidden');
    this.subtitleTimer = duration;
  }

  addKeyBadge(label) {
    const badge = document.createElement('div');
    badge.className = 'key-badge';
    badge.textContent = `🗝 ${label}`;
    this.dom.keyInventory.appendChild(badge);
  }

  checkActTransitions(force = false) {
    const px = this.player.pos.x;
    let newAct = 1;
    if (px >= 103.5) newAct = 4;
    else if (px >= 66.5) newAct = 3;
    else if (px >= 24.5) newAct = 2;

    this.currentAct = newAct;

    if (newAct > this.highestActVisited || force) {
      this.highestActVisited = newAct;
      if (newAct === 1) {
        this.showChapterBanner('ACT I', '塵と天鵞絨の奈落');
        this.showSubtitle('低い壁は [C] でしゃがんで潜り、木箱を押して足場にしよう。', 5.2);
      } else if (newAct === 2) {
        this.showChapterBanner('ACT II', '忘却の大舞台と監視の瞳');
        this.showSubtitle('赤いサーチライトに照らされると支配人に捕まる。天鵞絨の幕の後ろでやり過ごそう。', 5.5);
      } else if (newAct === 3) {
        this.showChapterBanner('ACT III', '照明桟橋の追跡劇');
        this.showSubtitle('[Shift] でダッシュ！ 隙間を跳び越え、障害物を潜り抜けろ！', 4.8);
      } else if (newAct === 4) {
        this.showChapterBanner('ACT IV', '終幕の大シャンデリア');
        this.showSubtitle('上階バルコニーのウインチを操作し、大シャンデリアを落として道を切り開け！', 5.2);
      }
    }
  }

  updateWorldPrompt() {
    // Check nearby lever / key interactables or pushable crates
    let bestPrompt = null;
    let bestWorldPos = null;

    for (const item of this.world.interactables) {
      if (item.used) continue;
      const dist = Math.hypot(this.player.pos.x - item.x, this.player.pos.y - item.y);
      if (dist <= item.radius) {
        bestPrompt = { key: item.keyText, label: item.label, item };
        bestWorldPos = new THREE.Vector3(item.x, item.y + 1.35, 0);
        break;
      }
    }

    if (!bestPrompt) {
      for (const crate of this.world.pushCrates) {
        const dist = Math.hypot(this.player.pos.x - crate.x, this.player.pos.y - crate.y);
        if (dist <= 1.55) {
          bestPrompt = { key: 'E', label: '押す / 引く' };
          bestWorldPos = new THREE.Vector3(crate.x, crate.y + crate.height + 0.45, 0);
          break;
        }
      }
    }

    if (bestPrompt && bestWorldPos) {
      // Trigger interaction if E was pressed this frame
      if (this.input.interactPressed && bestPrompt.item) {
        bestPrompt.item.trigger(this.player, this);
        this.input.interactPressed = false;
      }

      // Project 3D world position to 2D screen coordinates
      const projected = bestWorldPos.clone().project(this.camera);
      const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-projected.y * 0.5 + 0.5) * window.innerHeight;

      this.dom.promptKey.textContent = bestPrompt.key;
      this.dom.promptLabel.textContent = bestPrompt.label;
      this.dom.worldPrompt.style.left = `${sx}px`;
      this.dom.worldPrompt.style.top = `${sy}px`;
      this.dom.worldPrompt.classList.remove('hidden');
    } else {
      this.dom.worldPrompt.classList.add('hidden');
    }

    this.input.interactPressed = false;
  }

  triggerDeathAndRespawn() {
    if (this.state === 'dying') return;
    this.state = 'dying';
    this.deaths++;
    this.player.isDead = true;
    this.sound.playAlertSting();
    this.cameraDirector.addTrauma(0.9);
    this.dom.caughtOverlay.classList.remove('hidden');

    setTimeout(() => {
      this.world.resetForCheckpoint(this.currentAct, this.player);
      this.cameraDirector.snapToPlayer(this.player);
      this.dom.caughtOverlay.classList.add('hidden');
      this.state = 'playing';
    }, 1500);
  }

  triggerVictory() {
    if (this.state === 'ending') return;
    this.state = 'ending';
    this.sound.setChaseIntensity(0);
    this.sound.playKeyPickup();

    const elapsedSec = Math.round((performance.now() - this.startTime) / 1000);
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    this.dom.endingStats.textContent = `上演時間: ${mins}分${secs}秒 ／ やり直し回数: ${this.deaths}回`;

    this.dom.topHud.classList.add('hidden');
    this.dom.controlsBar.classList.add('hidden');
    this.dom.worldPrompt.classList.add('hidden');
    this.dom.endingScreen.classList.remove('hidden');
  }

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (this.state === 'title') {
      // Gently orbit camera on the title screen
      const t = now * 0.0004;
      this.camera.position.set(36 + Math.sin(t) * 6, 7.2, 16.5);
      this.camera.lookAt(36, 5.2, 0);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.state === 'playing') {
      this.player.update(
        dt,
        this.input,
        this.world.colliders,
        this.world.pushCrates,
        this.world.hidingZones
      );

      const status = this.world.update(dt, this.player, this);
      this.checkActTransitions(false);
      this.updateWorldPrompt();

      // Update danger vignette from red spotlight exposure or chase proximity
      const dangerAlpha = Math.max(
        this.world.exposureLevel * 0.85,
        this.world.chaseActive ? 0.38 : 0
      );
      this.dom.dangerVignette.style.opacity = dangerAlpha.toFixed(2);

      if (status) {
        if (
          status.event === 'caught_spotlight' ||
          status.event === 'caught_maestro' ||
          status.event === 'fell_catwalk'
        ) {
          this.triggerDeathAndRespawn();
        } else if (status.event === 'escaped_victory') {
          this.triggerVictory();
        }
      }
    }

    // Fade timers for chapter banner and subtitle
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.dom.chapterBanner.classList.add('hidden');
      }
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) {
        this.dom.subtitleBox.classList.add('hidden');
      }
    }

    this.cameraDirector.update(
      dt,
      this.player,
      this.world.foregroundOccluders,
      this.world.chaseActive
    );

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new TheaterEscapeGame();
});
