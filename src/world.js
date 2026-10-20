import * as THREE from 'three';

/**
 * World & Level Builder for "LE THÉÂTRE DES OMBRES"
 *
 * Constructs the 4 distinct theatrical acts across X = -10 to X = +140:
 * - Act I (X: -10 .. 25): Understage Prop Cellar & Freight Lift Shaft
 * - Act II (X: 25 .. 67): The Grand Proscenium Stage & Watcher Spotlights
 * - Act III (X: 67 .. 103): The Fly-Gallery Catwalk & Maestro Chase
 * - Act IV (X: 103 .. 140): The Grand Chandelier Foyer & Dawn Escape
 *
 * Also builds "The Maestro" (Puppeteer Monster) with dynamic limbs, glowing mask, and control strings.
 */
export class TheaterWorld {
  constructor(scene, sound, cameraDirector) {
    this.scene = scene;
    this.sound = sound;
    this.cameraDirector = cameraDirector;

    this.colliders = [];
    this.pushCrates = [];
    this.hidingZones = [];
    this.foregroundOccluders = [];
    this.interactables = [];
    this.spotlights = [];
    this.animatedProps = [];

    // Dynamic puzzle states
    this.liftActive = false;
    this.liftY = 0;
    this.liftDir = 1;

    this.stageBridgeLowered = false;
    this.stageGateOpen = false;

    this.chaseActive = false;
    this.chaseCompleted = false;
    this.maestroX = 64.0;
    this.maestroY = 6.2;

    this.chandelierDropped = false;
    this.chandelierY = 9.5;
    this.chandelierVelY = 0;

    this.exposureLevel = 0; // 0..1 when caught in red spotlight

    this.initMaterials();
    this.buildLightingAndAtmosphere();
    this.buildAct1Understage();
    this.buildAct2GrandStage();
    this.buildAct3CatwalkChase();
    this.buildAct4GrandFoyer();
    this.buildMaestroEntity();
    this.buildDustParticles();
  }

  initMaterials() {
    this.mats = {
      darkWood: new THREE.MeshStandardMaterial({
        color: 0x241914,
        roughness: 0.82,
        metalness: 0.08
      }),
      stageFloor: new THREE.MeshStandardMaterial({
        color: 0x2f1f18,
        roughness: 0.65,
        metalness: 0.12
      }),
      stoneWall: new THREE.MeshStandardMaterial({
        color: 0x14121a,
        roughness: 0.9,
        metalness: 0.05
      }),
      velvetCurtain: new THREE.MeshStandardMaterial({
        color: 0x680e19,
        roughness: 0.85,
        metalness: 0.05
      }),
      velvetDark: new THREE.MeshStandardMaterial({
        color: 0x420810,
        roughness: 0.9
      }),
      brass: new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.28,
        metalness: 0.85
      }),
      iron: new THREE.MeshStandardMaterial({
        color: 0x262932,
        roughness: 0.5,
        metalness: 0.75
      }),
      crateWood: new THREE.MeshStandardMaterial({
        color: 0x5c3c24,
        roughness: 0.75,
        metalness: 0.1
      }),
      glowingGold: new THREE.MeshBasicMaterial({
        color: 0xffe07d
      }),
      crimsonGlow: new THREE.MeshBasicMaterial({
        color: 0xff2a38
      }),
      dawnLightMat: new THREE.MeshBasicMaterial({
        color: 0x9ec5ff,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    };
  }

  buildLightingAndAtmosphere() {
    this.scene.background = new THREE.Color(0x0b0914);
    this.scene.fog = new THREE.FogExp2(0x0d0a18, 0.022);

    // Subtle moody ambient + hemisphere light with stronger theater rim separation
    const hemi = new THREE.HemisphereLight(0x52436e, 0x1a121c, 1.35);
    this.scene.add(hemi);

    // Main directional moonlight / stage top-light casting crisp 2.5D shadows
    const dirLight = new THREE.DirectionalLight(0xc2d0f0, 1.45);
    dirLight.position.set(45, 24, 14);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 65;
    dirLight.shadow.camera.left = -75;
    dirLight.shadow.camera.right = 75;
    dirLight.shadow.camera.top = 25;
    dirLight.shadow.camera.bottom = -10;
    this.scene.add(dirLight);
  }

  /**
   * Helper to add a solid 2.5D platform / wall collider and its 3D mesh
   */
  addPlatform(minX, maxX, minY, maxY, depth = 3.2, mat = this.mats.darkWood, opts = {}) {
    const w = maxX - minX;
    const h = maxY - minY;
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;

    const geo = new THREE.BoxGeometry(w, h, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, opts.zOffset || 0);
    mesh.receiveShadow = true;
    if (!opts.noShadow) mesh.castShadow = true;
    this.scene.add(mesh);

    // Optional gold trim on top edge for visual readability
    if (opts.trimTop) {
      const trimGeo = new THREE.BoxGeometry(w + 0.06, 0.08, depth + 0.08);
      const trim = new THREE.Mesh(trimGeo, this.mats.brass);
      trim.position.set(cx, maxY - 0.04, opts.zOffset || 0);
      this.scene.add(trim);
    }

    const collider = {
      minX,
      maxX,
      minY,
      maxY,
      mesh,
      noClimb: !!opts.noClimb
    };
    if (!opts.decorOnly) {
      this.colliders.push(collider);
    }
    return collider;
  }

  /**
   * Adds a movable crate for puzzles
   */
  addPushCrate(x, y, size = 1.15, minX = -10, maxX = 140) {
    const group = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      this.mats.crateWood
    );
    box.position.y = size * 0.5;
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);

    // Brass corner frame accents
    const frameGeo = new THREE.BoxGeometry(size + 0.05, 0.1, size + 0.05);
    const topFrame = new THREE.Mesh(frameGeo, this.mats.brass);
    topFrame.position.y = size - 0.06;
    const botFrame = new THREE.Mesh(frameGeo, this.mats.brass);
    botFrame.position.y = 0.06;
    group.add(topFrame, botFrame);

    group.position.set(x, y, 0);
    this.scene.add(group);

    const crate = {
      x,
      y,
      halfW: size * 0.5,
      height: size,
      minX,
      maxX,
      mesh: group
    };
    this.pushCrates.push(crate);
    return crate;
  }

  /**
   * Adds a foreground silhouette / curtain that automatically becomes translucent when the player walks behind it
   */
  addForegroundCurtain(x, y, w, h, z = 2.4) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3b070e,
      roughness: 0.9,
      transparent: true,
      opacity: 0.88
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.25), mat);
    mesh.position.set(x, y + h * 0.5, z);
    this.scene.add(mesh);

    this.foregroundOccluders.push({
      x,
      fadeRadius: w * 0.85 + 1.8,
      baseOpacity: 0.88,
      material: mat
    });
  }

  /**
   * Adds a volumetric cone + PointLight spotlight
   */
  addTheatricalSpotlight({
    x,
    y,
    targetX,
    targetY = 0,
    color = 0xffdca8,
    coneColor = 0xffe4b5,
    intensity = 4.5,
    isHazard = false,
    swingSpeed = 0,
    swingAmp = 0
  }) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    this.scene.add(pivot);

    // Lamp housing mesh
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.35, 0.5, 10),
      this.mats.iron
    );
    lamp.rotation.x = Math.PI * 0.5;
    pivot.add(lamp);

    // Volumetric light cone
    const coneHeight = y - targetY;
    const coneGeo = new THREE.ConeGeometry(2.1, coneHeight, 20, 1, true);
    coneGeo.translate(0, -coneHeight * 0.5, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      color: coneColor,
      transparent: true,
      opacity: isHazard ? 0.19 : 0.11,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    pivot.add(coneMesh);

    // Actual Three.js SpotLight
    const spot = new THREE.SpotLight(color, intensity, coneHeight + 6, 0.42, 0.55, 1.5);
    spot.position.set(0, 0, 0);
    const targetObj = new THREE.Object3D();
    targetObj.position.set(targetX - x, -coneHeight, 0);
    pivot.add(targetObj);
    spot.target = targetObj;
    pivot.add(spot);

    // Floor light pool ring
    const poolGeo = new THREE.CircleGeometry(1.95, 24);
    const poolMat = new THREE.MeshBasicMaterial({
      color: coneColor,
      transparent: true,
      opacity: isHazard ? 0.32 : 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.rotation.x = -Math.PI * 0.5;
    poolMesh.position.set(x, targetY + 0.03, 0);
    this.scene.add(poolMesh);

    const entry = {
      pivot,
      coneMat,
      poolMesh,
      poolMat,
      spot,
      baseX: x,
      y,
      targetY,
      currentCenterX: targetX,
      isHazard,
      swingSpeed,
      swingAmp,
      phase: Math.random() * Math.PI * 2
    };
    this.spotlights.push(entry);
    return entry;
  }

  /**
   * Adds an interactive lever switch with brass handle & glowing indicator
   */
  addLever({ x, y, label, onActivate }) {
    const group = new THREE.Group();
    group.position.set(x, y, -0.45);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.3, 0.35),
      this.mats.iron
    );
    base.position.y = 0.15;
    group.add(base);

    const handlePivot = new THREE.Group();
    handlePivot.position.y = 0.25;
    handlePivot.rotation.z = 0.45;
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8),
      this.mats.brass
    );
    rod.position.y = 0.35;
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      this.mats.glowingGold
    );
    knob.position.y = 0.75;
    handlePivot.add(rod, knob);
    group.add(handlePivot);

    const light = new THREE.PointLight(0xffcb5c, 1.2, 3.5);
    light.position.set(0, 0.85, 0.3);
    group.add(light);

    this.scene.add(group);

    const item = {
      x,
      y,
      radius: 1.35,
      keyText: 'E',
      label,
      used: false,
      handlePivot,
      light,
      trigger: () => {
        if (item.used) return;
        item.used = true;
        handlePivot.rotation.z = -0.45;
        knob.material = new THREE.MeshBasicMaterial({ color: 0x5eff82 });
        light.color.setHex(0x5eff82);
        this.sound.playLever();
        onActivate();
      }
    };
    this.interactables.push(item);
    return item;
  }

  // ===========================================================================
  // ACT I: 塵と天鵞絨の奈落 (Understage Prop Cellar & Lift Shaft, X: -10 .. 25)
  // ===========================================================================
  buildAct1Understage() {
    // Left boundary wall
    this.addPlatform(-10.5, -8.5, -1, 10, 4, this.mats.stoneWall, { noClimb: true });

    // Main cellar floor
    this.addPlatform(-9.0, 19.5, -1.5, 0.0, 4.2, this.mats.stageFloor, { trimTop: true });

    // Low ceiling over initial dressing room (creates claustrophobic framing)
    this.addPlatform(-9.0, 11.2, 4.3, 9.5, 4.2, this.mats.stoneWall, { noClimb: true });

    // Hanging Partition Wall at X = 3.2..4.2 that leaves a 0.95m crawlspace underneath (teaches Crouch!)
    this.addPlatform(3.2, 4.3, 1.0, 4.4, 3.4, this.mats.darkWood, { noClimb: true, trimTop: true });

    // Back wall dressing mirrors, glowing wall sconces & old marionette silhouettes in background (Z = -1.9)
    for (let x = -7; x <= 18; x += 4.5) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 6.5, 0.5),
        this.mats.darkWood
      );
      pillar.position.set(x, 3.0, -1.85);
      this.scene.add(pillar);

      const sconceBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        this.mats.glowingGold
      );
      sconceBulb.position.set(x, 2.8, -1.55);
      this.scene.add(sconceBulb);

      const sconceLight = new THREE.PointLight(0xffb85c, 2.2, 7.5);
      sconceLight.position.set(x, 2.75, -1.2);
      this.scene.add(sconceLight);
    }

    // Warm antique dressing mirror lamp at spawn
    this.addTheatricalSpotlight({
      x: -5.5,
      y: 4.1,
      targetX: -5.5,
      targetY: 0,
      color: 0xffc67a,
      coneColor: 0xffd599,
      intensity: 3.8
    });

    // Spotlight highlighting the crawlspace and the movable crate
    this.addTheatricalSpotlight({
      x: 7.2,
      y: 4.1,
      targetX: 7.2,
      targetY: 0,
      color: 0xffcc88,
      coneColor: 0xffdca8,
      intensity: 3.6
    });

    // Foreground velvet drape at X = 0.5 (demonstrates foreground occlusion fading!)
    this.addForegroundCurtain(0.5, 0, 1.8, 4.2, 2.2);

    // Movable prop crate in Act I (Player pushes it right to X ~ 10.6 to climb onto the raised switch balcony)
    this.addPushCrate(6.8, 0.0, 1.18, 4.8, 11.2);

    // Raised Switch Balcony at X = 11.4 .. 15.6, Y = 0 .. 1.95 (Too high to jump directly; requires crate or mantle!)
    this.addPlatform(11.4, 15.6, 0.0, 1.95, 3.2, this.mats.darkWood, { trimTop: true });

    // Lever on top of the balcony that powers the Understage Freight Lift
    this.addLever({
      x: 13.8,
      y: 1.95,
      label: '奈落昇降機の電源を入れる',
      onActivate: () => {
        this.liftActive = true;
        // Cinematic camera focus cutaway showing the freight lift activating & ascending
        this.cameraDirector.triggerFocus({
          pos: new THREE.Vector3(20.5, 4.2, 11.5),
          target: new THREE.Vector3(21.2, 2.6, 0),
          fov: 32,
          duration: 2.5,
          label: '85mm — 舞台昇降機起動',
          letterbox: true
        });
      }
    });

    // Dynamic Freight Elevator Platform at X = 19.6 .. 23.2
    this.liftCollider = this.addPlatform(19.6, 23.2, -0.35, 0.0, 3.0, this.mats.iron, {
      trimTop: true
    });

    // Lift Shaft background cables & gears
    const cableGeo = new THREE.CylinderGeometry(0.04, 0.04, 12, 6);
    const cableL = new THREE.Mesh(cableGeo, this.mats.brass);
    const cableR = new THREE.Mesh(cableGeo, this.mats.brass);
    cableL.position.set(20.0, 5.5, -0.9);
    cableR.position.set(22.8, 5.5, -0.9);
    this.scene.add(cableL, cableR);

    this.addTheatricalSpotlight({
      x: 21.4,
      y: 9.5,
      targetX: 21.4,
      targetY: 0,
      color: 0xaaccff,
      coneColor: 0x99bbff,
      intensity: 4.5
    });
  }

  // ===========================================================================
  // ACT II: 忘却の大舞台と監視の光 (The Grand Proscenium Stage, X: 25 .. 67)
  // ===========================================================================
  buildAct2GrandStage() {
    // Upper stage floor starts at Y = 3.8 from X = 23.3 to X = 68.0
    this.addPlatform(23.3, 68.0, -2.0, 3.8, 5.0, this.mats.stageFloor, {
      trimTop: true,
      noClimb: true
    });

    // Grand Proscenium Archway & Velvet Valance at X = 26.5 and X = 54.0
    this.buildProsceniumArch(26.2, 3.8);
    this.buildProsceniumArch(54.0, 3.8);

    // Distant Auditorium Backdrop (rows of red velvet opera boxes in deep Z = -5.5)
    for (let bx = 29; bx <= 51; bx += 5.5) {
      for (let by = 5.0; by <= 10.5; by += 3.8) {
        const balcony = new THREE.Mesh(
          new THREE.BoxGeometry(4.2, 1.1, 1.5),
          this.mats.velvetCurtain
        );
        balcony.position.set(bx, by, -5.2);
        this.scene.add(balcony);

        const goldRail = new THREE.Mesh(
          new THREE.BoxGeometry(4.3, 0.14, 1.6),
          this.mats.brass
        );
        goldRail.position.set(bx, by + 0.6, -5.2);
        this.scene.add(goldRail);

        const boxLamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          this.mats.glowingGold
        );
        boxLamp.position.set(bx, by + 1.35, -4.6);
        this.scene.add(boxLamp);
      }
      const auditoriumGlow = new THREE.PointLight(0xd4884a, 2.8, 12);
      auditoriumGlow.position.set(bx, 7.5, -3.5);
      this.scene.add(auditoriumGlow);
    }

    // Hiding Velvet Curtains along the Grand Stage (Player crouches or stands behind them to evade the crimson searchlights)
    const curtainPositions = [31.0, 38.0, 45.2];
    curtainPositions.forEach((cx) => {
      // Deep velvet hanging curtain in background/midground
      const curtain = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 7.5, 0.9),
        this.mats.velvetCurtain
      );
      curtain.position.set(cx, 3.8 + 3.75, -0.55);
      curtain.castShadow = true;
      this.scene.add(curtain);

      // Gold tassel tie-back
      const tie = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.16, 1.0),
        this.mats.brass
      );
      tie.position.set(cx, 3.8 + 2.2, -0.55);
      this.scene.add(tie);

      // Register as safe shadow hiding zone (even standing or crouching inside X range shelters from searchlight)
      this.hidingZones.push({
        minX: cx - 1.25,
        maxX: cx + 1.25,
        y: 3.8,
        alwaysHide: true
      });
    });

    // Two Sweeping Crimson "Maestro Searchlights" on the Grand Stage
    this.addTheatricalSpotlight({
      x: 34.5,
      y: 13.0,
      targetX: 34.5,
      targetY: 3.8,
      color: 0xff1e2e,
      coneColor: 0xff2233,
      intensity: 6.5,
      isHazard: true,
      swingSpeed: 1.25,
      swingAmp: 4.4
    });

    this.addTheatricalSpotlight({
      x: 42.5,
      y: 13.0,
      targetX: 42.5,
      targetY: 3.8,
      color: 0xff1e2e,
      coneColor: 0xff2233,
      intensity: 6.5,
      isHazard: true,
      swingSpeed: 1.45,
      swingAmp: 4.6
    });

    // Warm spotlight illuminating the Brass Key pedestal on the right side of the stage
    this.addTheatricalSpotlight({
      x: 50.5,
      y: 11.5,
      targetX: 50.5,
      targetY: 3.8,
      color: 0xffe08a,
      coneColor: 0xffe49e,
      intensity: 5.0
    });

    // Locked Iron Stage Gate at X = 56.5 (Blocks access to Act III Catwalk Lift until unlocked with the Brass Key)
    this.stageGateCollider = this.addPlatform(
      56.2,
      57.0,
      3.8,
      8.5,
      3.2,
      this.mats.iron,
      { noClimb: true }
    );

    // Ornate Brass Key on Pedestal at X = 50.5, Y = 3.8
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 0.9, 12),
      this.mats.darkWood
    );
    pedestal.position.set(50.5, 3.8 + 0.45, -0.35);
    this.scene.add(pedestal);

    const keyMesh = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.18, 0.045, 32, 8),
      this.mats.brass
    );
    keyMesh.position.set(50.5, 3.8 + 1.25, -0.35);
    this.scene.add(keyMesh);
    this.animatedProps.push({ mesh: keyMesh, baseY: 3.8 + 1.25 });

    // Key pickup interaction
    const keyInteract = {
      x: 50.5,
      y: 3.8,
      radius: 1.4,
      keyText: 'E',
      label: '黄金のぜんまい鍵を拾う',
      used: false,
      trigger: (player, ui) => {
        if (keyInteract.used) return;
        keyInteract.used = true;
        keyMesh.visible = false;
        player.hasBrassKey = true;
        this.sound.playKeyPickup();
        ui.addKeyBadge('黄金のぜんまい鍵');
        ui.showSubtitle('「黄金のぜんまい鍵」を手に入れた。舞台袖の鉄格子を開けよう。', 4.0);
      }
    };
    this.interactables.push(keyInteract);

    // Gate lock interaction at X = 55.4
    const gateInteract = {
      x: 55.4,
      y: 3.8,
      radius: 1.5,
      keyText: 'E',
      label: '舞台袖の鉄格子を解錠する',
      used: false,
      trigger: (player, ui) => {
        if (gateInteract.used) return;
        if (!player.hasBrassKey) {
          ui.showSubtitle('鍵が掛かっている……舞台上の「黄金のぜんまい鍵」が必要だ。', 3.2);
          return;
        }
        gateInteract.used = true;
        this.stageGateOpen = true;
        this.sound.playLever();
        ui.showSubtitle('鉄格子が開いた。上部の照明桟橋（キャットウォーク）へ登ろう。', 4.0);
        this.cameraDirector.triggerFocus({
          pos: new THREE.Vector3(56.5, 6.2, 10.5),
          target: new THREE.Vector3(56.6, 5.5, 0),
          fov: 32,
          duration: 2.0,
          label: '50mm — 舞台袖解錠',
          letterbox: true
        });
      }
    };
    this.interactables.push(gateInteract);

    // Stepping platforms in the Backstage Wing (X = 58 .. 66) leading up to Act III Catwalk at Y = 6.2
    this.addPlatform(58.5, 61.5, 3.8, 5.0, 3.0, this.mats.darkWood, { trimTop: true });
    this.addPlatform(62.2, 66.5, 3.8, 6.2, 3.0, this.mats.darkWood, { trimTop: true });
  }

  buildProsceniumArch(x, floorY) {
    const colGeo = new THREE.BoxGeometry(1.4, 10.5, 4.4);
    const col = new THREE.Mesh(colGeo, this.mats.velvetDark);
    col.position.set(x, floorY + 5.25, 0);
    this.scene.add(col);

    // Gold ornamental molding
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.35, 4.55),
      this.mats.brass
    );
    trim.position.set(x, floorY + 2.5, 0);
    this.scene.add(trim);

    this.addForegroundCurtain(x + 0.6, floorY, 1.5, 9.5, 2.3);
  }

  // ===========================================================================
  // ACT III: 照明桟橋の追跡 (The Catwalk & Maestro Chase, X: 67 .. 103)
  // ===========================================================================
  buildAct3CatwalkChase() {
    // High iron catwalk segments at Y = 6.2 with dramatic gaps & low obstacles
    // Segment 1: X = 66.5 .. 77.5
    this.addPlatform(66.5, 77.5, 5.7, 6.2, 2.8, this.mats.iron, { trimTop: true });

    // Segment 2 (after jump gap 77.5..79.3): X = 79.3 .. 89.8
    this.addPlatform(79.3, 89.8, 5.7, 6.2, 2.8, this.mats.iron, { trimTop: true });

    // Low hanging spotlight rig at X = 83.8..85.2 (Player must crouch-slide or duck under Y = 7.15..9.5)
    this.addPlatform(83.8, 85.2, 7.15, 9.8, 2.8, this.mats.iron, { noClimb: true });

    // Segment 3 (after jump gap 89.8..91.6): X = 91.6 .. 104.5
    this.addPlatform(91.6, 104.5, 5.7, 6.2, 2.8, this.mats.iron, { trimTop: true });

    // Crate obstacle to vault/climb over during the chase at X = 95.8
    this.addPlatform(95.6, 96.8, 6.2, 7.25, 2.4, this.mats.crateWood, { trimTop: true });

    // Safety net floor below the gaps so falling doesn't soft-lock (deals a quick respawn or lets player climb back)
    this.addPlatform(66.5, 104.5, 1.5, 2.2, 3.0, this.mats.darkWood);

    // Industrial catwalk background trusses & dramatic blue/crimson rim lights
    for (let cx = 69; cx <= 101; cx += 6.5) {
      const truss = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 7.0, 0.3),
        this.mats.iron
      );
      truss.position.set(cx, 9.2, -1.3);
      this.scene.add(truss);

      this.addTheatricalSpotlight({
        x: cx,
        y: 12.2,
        targetX: cx,
        targetY: 6.2,
        color: 0x88b4ff,
        coneColor: 0x77a2ff,
        intensity: 3.8
      });
    }

    // Heavy Fire Curtain Door at X = 102.5 that slams shut behind the player when they reach Act IV!
    this.chaseBlastDoor = this.addPlatform(
      102.2,
      103.0,
      9.6,
      14.2,
      3.2,
      this.mats.iron,
      { noClimb: true }
    );
  }

  // ===========================================================================
  // ACT IV: 終幕の大シャンデリアと夜明けのロビー (Climax & Escape, X: 103 .. 140)
  // ===========================================================================
  buildAct4GrandFoyer() {
    // Upper Control Balcony at X = 104.5 .. 115.5, Y = 6.2
    this.addPlatform(104.0, 115.5, 5.6, 6.2, 3.4, this.mats.darkWood, { trimTop: true });

    // Grand Foyer Marble Floor below at X = 103.5 .. 142.0, Y = 2.2
    this.addPlatform(103.5, 142.0, 0.0, 2.2, 5.5, this.mats.stageFloor, { trimTop: true });

    // Stepping tiers from Foyer Floor (Y=2.2) back up or down
    this.addPlatform(107.0, 110.2, 2.2, 3.6, 3.2, this.mats.darkWood, { trimTop: true });
    this.addPlatform(110.2, 113.2, 2.2, 4.9, 3.2, this.mats.darkWood, { trimTop: true });

    // THE GRAND CHANDELIER (Suspended at X = 118.5, Y = 9.5 above the Maestro's final ambush spot)
    this.chandelierGroup = new THREE.Group();
    this.chandelierGroup.position.set(118.5, this.chandelierY, 0);

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.14, 12, 24),
      this.mats.brass
    );
    ring1.rotation.x = Math.PI * 0.5;
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.12, 12, 20),
      this.mats.brass
    );
    ring2.rotation.x = Math.PI * 0.5;
    ring2.position.y = -0.65;

    const coreCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.75, 1),
      this.mats.glowingGold
    );
    coreCrystal.position.y = -0.4;

    const chain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 6.0, 8),
      this.mats.brass
    );
    chain.position.y = 3.0;

    this.chandelierLight = new THREE.PointLight(0xffdd88, 8.5, 18);
    this.chandelierLight.position.set(0, -0.5, 0);

    this.chandelierGroup.add(ring1, ring2, coreCrystal, chain, this.chandelierLight);
    this.scene.add(this.chandelierGroup);

    // Climax Winch Lever at X = 114.2, Y = 6.2 (Releases the Grand Chandelier to crush the Maestro & break the Foyer Barricade!)
    this.addLever({
      x: 114.2,
      y: 6.2,
      label: '大シャンデリアの鎖を断ち切る（終幕装置）',
      onActivate: () => {
        this.chandelierDropped = true;
        this.sound.playChandelierCrash();
        this.cameraDirector.addTrauma(0.95);
        // Dramatic Dutch-angle wide zoom cutaway watching the chandelier plummet and shatter the barricade
        this.cameraDirector.triggerFocus({
          pos: new THREE.Vector3(118.5, 5.2, 14.5),
          target: new THREE.Vector3(119.5, 3.8, 0),
          fov: 38,
          roll: 0.04,
          duration: 3.1,
          label: '21mm — 大シャンデリア崩落',
          letterbox: true
        });
      }
    });

    // Barricaded Grand Exit Doors at X = 123.5 (Shattered when the chandelier crashes!)
    this.foyerBarricade = this.addPlatform(
      123.0,
      124.2,
      2.2,
      8.5,
      3.8,
      this.mats.darkWood,
      { noClimb: true }
    );

    // Dawn Exit Portal & God-Rays at X = 129 .. 136
    const portalArch = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 7.5, 4.8),
      this.mats.DawnLightMat || this.mats.glowingGold
    );
    portalArch.position.set(132.5, 5.8, 0);
    this.scene.add(portalArch);

    // Volumetric Morning God-rays streaming in from the outside world
    for (let i = 0; i < 4; i++) {
      const rayGeo = new THREE.PlaneGeometry(3.2, 11.0);
      const ray = new THREE.Mesh(rayGeo, this.mats.dawnLightMat);
      ray.position.set(128.5 + i * 1.4, 5.8, -0.5 + i * 0.2);
      ray.rotation.z = 0.38;
      this.scene.add(ray);
    }

    const dawnPoint = new THREE.PointLight(0xaad4ff, 9.0, 22);
    dawnPoint.position.set(132.0, 6.0, 1.0);
    this.scene.add(dawnPoint);
  }

  // ===========================================================================
  // THE MAESTRO (Giant Porcelain Puppeteer Antagonist)
  // ===========================================================================
  buildMaestroEntity() {
    this.maestroGroup = new THREE.Group();
    this.maestroGroup.position.set(64.0, 6.2, -0.4);
    this.maestroGroup.visible = false;

    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0x120d18,
      roughness: 0.9
    });
    const maskMat = new THREE.MeshStandardMaterial({
      color: 0xede6d8,
      roughness: 0.3
    });

    // Tall looming torso (3.4m tall silhouette)
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 2.9, 10),
      cloakMat
    );
    body.position.y = 1.65;
    this.maestroGroup.add(body);

    // Eerie porcelain mask head
    const mask = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 14, 14),
      maskMat
    );
    mask.scale.set(0.85, 1.25, 0.9);
    mask.position.set(0.2, 3.15, 0);
    this.maestroGroup.add(mask);

    // Glowing crimson eyes on the Maestro
    const eyeL = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      this.mats.crimsonGlow
    );
    const eyeR = eyeL.clone();
    eyeL.position.set(0.52, 3.2, 0.16);
    eyeR.position.set(0.52, 3.2, -0.16);
    this.maestroGroup.add(eyeL, eyeR);

    // Articulated long puppeteer arms reaching toward the player
    const armGeo = new THREE.CylinderGeometry(0.08, 0.05, 1.9, 8);
    this.maestroArmL = new THREE.Mesh(armGeo, cloakMat);
    this.maestroArmR = new THREE.Mesh(armGeo, cloakMat);
    this.maestroArmL.position.set(0.65, 2.35, 0.45);
    this.maestroArmR.position.set(0.65, 2.35, -0.45);
    this.maestroArmL.rotation.z = -1.1;
    this.maestroArmR.rotation.z = -1.1;
    this.maestroGroup.add(this.maestroArmL, this.maestroArmR);

    // Eerie red point light attached to the Maestro
    const threatLight = new THREE.PointLight(0xff1a2b, 5.5, 9.0);
    threatLight.position.set(0.6, 2.6, 0.8);
    this.maestroGroup.add(threatLight);

    this.scene.add(this.maestroGroup);
  }

  buildDustParticles() {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = -10 + Math.random() * 150;
      positions[i * 3 + 1] = Math.random() * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe6b0,
      size: 0.065,
      transparent: true,
      opacity: 0.45
    });
    this.dustPoints = new THREE.Points(geo, mat);
    this.scene.add(this.dustPoints);
  }

  // ===========================================================================
  // WORLD UPDATE (Puzzles, Spotlights, Chase Sequence, Chandelier Climax)
  // ===========================================================================
  update(dt, player, ui) {
    const time = performance.now() * 0.001;

    // 1. Float animated props (e.g. Brass Key)
    for (const p of this.animatedProps) {
      p.mesh.rotation.y += dt * 1.8;
      p.mesh.position.y = p.baseY + Math.sin(time * 2.5) * 0.08;
    }

    // 2. Subtle floating dust motes
    if (this.dustPoints) {
      this.dustPoints.rotation.y = Math.sin(time * 0.05) * 0.02;
    }

    // 3. Act I: Understage Freight Lift movement
    if (this.liftActive) {
      this.liftY += this.liftDir * dt * 1.45;
      if (this.liftY >= 3.8) {
        this.liftY = 3.8;
        this.liftDir = -1;
      } else if (this.liftY <= 0.0) {
        this.liftY = 0.0;
        this.liftDir = 1;
      }
      this.liftCollider.minY = this.liftY - 0.35;
      this.liftCollider.maxY = this.liftY;
      this.liftCollider.mesh.position.y = this.liftY - 0.175;
    }

    // 4. Act II: Stage Gate Opening
    if (this.stageGateOpen && this.stageGateCollider.minY < 8.4) {
      this.stageGateCollider.minY += dt * 2.8;
      this.stageGateCollider.maxY += dt * 2.8;
      this.stageGateCollider.mesh.position.y += dt * 2.8;
    }

    // 5. Act II: Sweeping Crimson Spotlights & Stealth Detection
    let detectedInSpotlight = false;
    for (const sp of this.spotlights) {
      if (sp.swingSpeed > 0) {
        const offset = Math.sin(time * sp.swingSpeed + sp.phase) * sp.swingAmp;
        sp.currentCenterX = sp.baseX + offset;
        const angle = Math.atan2(offset, sp.y - sp.targetY);
        sp.pivot.rotation.z = angle;
        sp.poolMesh.position.x = sp.currentCenterX;
      }

      if (sp.isHazard) {
        const dist = Math.abs(player.pos.x - sp.currentCenterX);
        const onStageFloor = Math.abs(player.pos.y - sp.targetY) < 1.8;
        if (dist < 1.55 && onStageFloor && !player.isHiddenInShadow) {
          detectedInSpotlight = true;
        }
      }
    }

    if (detectedInSpotlight) {
      this.exposureLevel = Math.min(1, this.exposureLevel + dt * 1.15);
      this.cameraDirector.addTrauma(dt * 0.45);
      if (this.exposureLevel >= 1.0) {
        return { event: 'caught_spotlight' };
      }
    } else {
      this.exposureLevel = Math.max(0, this.exposureLevel - dt * 1.4);
    }

    // 6. Act III: Catwalk Chase Sequence Trigger & Update
    if (player.pos.x >= 68.5 && player.pos.x < 102.0 && !this.chaseCompleted) {
      if (!this.chaseActive) {
        this.chaseActive = true;
        this.maestroX = 63.8;
        this.maestroY = 6.2;
        this.maestroGroup.visible = true;
        this.sound.playAlertSting();
        this.cameraDirector.addTrauma(0.6);
        ui.showSubtitle('劇場の支配人が目を覚ました！ 右へ走り抜けろ！（Shiftでダッシュ）', 4.5);
      }
    }

    if (this.chaseActive && !this.chaseCompleted) {
      // Maestro relentlessly pursues the player across the catwalk
      const chaseSpeed = 4.65;
      this.maestroX += chaseSpeed * dt;
      // Keep Maestro rubber-banded so it's always thrillingly close but fair
      if (player.pos.x - this.maestroX > 7.5) {
        this.maestroX = player.pos.x - 7.5;
      }

      this.maestroGroup.position.set(
        this.maestroX,
        6.0 + Math.sin(time * 7) * 0.22,
        -0.25
      );
      this.maestroArmL.rotation.z = -1.2 + Math.sin(time * 9) * 0.35;
      this.maestroArmR.rotation.z = -1.2 - Math.sin(time * 9) * 0.35;

      const distToMaestro = player.pos.x - this.maestroX;
      const proximityDanger = 1.0 - Math.min(1, Math.max(0, (distToMaestro - 1.2) / 6.0));
      this.sound.setChaseIntensity(Math.max(0.4, proximityDanger));

      if (distToMaestro < 1.05 && Math.abs(player.pos.y - 6.2) < 2.2) {
        return { event: 'caught_maestro' };
      }

      // If player falls into the under-catwalk pit during chase
      if (player.pos.y < 3.5 && player.pos.x > 67 && player.pos.x < 102) {
        return { event: 'fell_catwalk' };
      }

      // Crossing X = 102.8 slams the Fire Curtain Door shut and ends the catwalk chase!
      if (player.pos.x >= 102.8) {
        this.chaseCompleted = true;
        this.chaseActive = false;
        this.sound.setChaseIntensity(0.2);
        this.sound.playLever();
        this.cameraDirector.addTrauma(0.7);
        ui.showSubtitle('防火扉が閉まった……だが支配人は正面ロビーへ回り込んでいる！', 4.5);
        // Move Maestro to under the Grand Chandelier in Act IV for the finale!
        this.maestroGroup.position.set(118.5, 2.2, -0.3);
      }
    }

    // Slam fire curtain door down when chase completes
    if (this.chaseCompleted && this.chaseBlastDoor.minY > 6.2) {
      this.chaseBlastDoor.minY -= dt * 14.0;
      this.chaseBlastDoor.maxY -= dt * 14.0;
      this.chaseBlastDoor.mesh.position.y -= dt * 14.0;
    }

    // 7. Act IV: Grand Chandelier Climax & Barricade Destruction
    if (this.chandelierDropped) {
      if (this.chandelierY > 2.6) {
        this.chandelierVelY += 25.0 * dt;
        this.chandelierY -= this.chandelierVelY * dt;
        if (this.chandelierY <= 2.6) {
          this.chandelierY = 2.6;
          this.cameraDirector.addTrauma(1.0);
          // Hide crushed Maestro and open the Foyer Barricade!
          this.maestroGroup.visible = false;
          this.foyerBarricade.minY = 12.0;
          this.foyerBarricade.maxY = 18.0;
          this.foyerBarricade.mesh.visible = false;
          this.sound.setChaseIntensity(0);
          ui.showSubtitle('大シャンデリアが支配人を打ち砕き、正面扉が破壊された！ 光の中へ脱出しよう！', 5.0);
        }
        this.chandelierGroup.position.y = this.chandelierY;
      }
    } else if (this.chaseCompleted) {
      // Maestro waits menacingly below the chandelier in Act IV blocking the lower floor
      this.maestroGroup.visible = true;
      this.maestroGroup.position.set(118.5 + Math.sin(time * 2) * 0.6, 2.2, -0.2);
      if (
        player.pos.x > 116.2 &&
        player.pos.x < 121.0 &&
        player.pos.y < 4.2
      ) {
        return { event: 'caught_maestro' };
      }
    }

    // 8. Check Victory Condition (walking out into the Dawn Portal at X >= 129.5)
    if (player.pos.x >= 129.5) {
      return { event: 'escaped_victory' };
    }

    return null;
  }

  resetForCheckpoint(actNumber, player) {
    this.exposureLevel = 0;
    if (actNumber === 1) {
      player.respawn(-6.5, 0.1);
    } else if (actNumber === 2) {
      this.liftActive = true;
      player.respawn(27.5, 3.9);
    } else if (actNumber === 3) {
      this.stageGateOpen = true;
      this.chaseActive = false;
      this.chaseCompleted = false;
      this.maestroX = 63.5;
      this.maestroGroup.visible = false;
      this.chaseBlastDoor.minY = 9.6;
      this.chaseBlastDoor.maxY = 14.2;
      this.chaseBlastDoor.mesh.position.y = 11.9;
      player.respawn(67.2, 6.3);
    } else if (actNumber === 4) {
      this.chaseCompleted = true;
      this.chaseActive = false;
      this.maestroGroup.visible = !this.chandelierDropped;
      this.maestroGroup.position.set(118.5, 2.2, -0.2);
      player.respawn(105.5, 6.3);
    }
  }
}
