import * as THREE from 'three';

/**
 * Protagonist: "Noa" — A small clockwork-heart marionette child in a crimson/amber cape
 * Features:
 * - Articulated 3D mesh (head, glowing amber eyes, cape/cloak, torso, limbs, warm lantern aura)
 * - Responsive 2.5D movement (walk, sprint, crouch/sneak, jump, automatic ledge climb, crate push/pull)
 */
export class Player {
  constructor(scene, sound) {
    this.scene = scene;
    this.sound = sound;

    this.pos = new THREE.Vector3(-6.5, 0, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.width = 0.65;
    this.height = 1.45;
    this.facing = 1; // 1 = right, -1 = left

    this.isGrounded = false;
    this.isCrouching = false;
    this.isPushing = false;
    this.isClimbingLedge = false;
    this.isHiddenInShadow = false;
    this.hasBrassKey = false;
    this.isDead = false;

    this.ledgeTimer = 0;
    this.ledgeStart = new THREE.Vector3();
    this.ledgeEnd = new THREE.Vector3();

    this.walkCycle = 0;
    this.stepTimer = 0;

    this.group = new THREE.Group();
    this.buildMesh();
    this.scene.add(this.group);
  }

  buildMesh() {
    // Materials
    const porcelainMat = new THREE.MeshStandardMaterial({
      color: 0xe8dfd1,
      roughness: 0.45,
      metalness: 0.1
    });

    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0x7b1e26, // Deep theater crimson cloak
      roughness: 0.75,
      metalness: 0.05
    });

    const darkClothMat = new THREE.MeshStandardMaterial({
      color: 0x1c1824,
      roughness: 0.8
    });

    const eyeGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffd269
    });

    // Body container for squash/stretch & crouch scaling
    this.bodyPivot = new THREE.Group();
    this.group.add(this.bodyPivot);

    // Conical Cloak / Coat (Iconic silhouette like Little Nightmares)
    const cloakGeo = new THREE.ConeGeometry(0.42, 0.92, 12);
    this.cloakMesh = new THREE.Mesh(cloakGeo, cloakMat);
    this.cloakMesh.position.y = 0.72;
    this.cloakMesh.castShadow = true;
    this.cloakMesh.receiveShadow = true;
    this.bodyPivot.add(this.cloakMesh);

    // Hood peak (positioned smoothly on the crown & back of the head so it never obscures the face)
    const hoodGeo = new THREE.ConeGeometry(0.25, 0.38, 10);
    this.hoodMesh = new THREE.Mesh(hoodGeo, cloakMat);
    this.hoodMesh.position.set(-0.09, 1.46, 0);
    this.hoodMesh.rotation.z = 0.42;
    this.hoodMesh.castShadow = true;
    this.bodyPivot.add(this.hoodMesh);

    // Head (Porcelain doll head)
    const headGeo = new THREE.SphereGeometry(0.23, 16, 16);
    this.headMesh = new THREE.Mesh(headGeo, porcelainMat);
    this.headMesh.position.set(0.03, 1.24, 0);
    this.headMesh.castShadow = true;
    this.bodyPivot.add(this.headMesh);

    // Glowing eyes (visible in dark silhouettes)
    const eyeGeo = new THREE.SphereGeometry(0.034, 8, 8);
    this.leftEye = new THREE.Mesh(eyeGeo, eyeGlowMat);
    this.rightEye = new THREE.Mesh(eyeGeo, eyeGlowMat);
    this.leftEye.position.set(0.19, 1.25, 0.08);
    this.rightEye.position.set(0.19, 1.25, -0.08);
    this.bodyPivot.add(this.leftEye, this.rightEye);

    // Broken marionette wooden crosspiece on back / strings hint
    const keyWindGeo = new THREE.TorusGeometry(0.11, 0.025, 8, 16);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.8,
      roughness: 0.25
    });
    this.windKey = new THREE.Mesh(keyWindGeo, brassMat);
    this.windKey.position.set(-0.28, 0.88, 0);
    this.windKey.rotation.y = Math.PI / 2;
    this.bodyPivot.add(this.windKey);

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.065, 0.28, 6, 8);
    this.leftLeg = new THREE.Mesh(legGeo, darkClothMat);
    this.rightLeg = new THREE.Mesh(legGeo, darkClothMat);
    this.leftLeg.position.set(0, 0.22, 0.11);
    this.rightLeg.position.set(0, 0.22, -0.11);
    this.leftLeg.castShadow = true;
    this.rightLeg.castShadow = true;
    this.bodyPivot.add(this.leftLeg, this.rightLeg);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.05, 0.26, 6, 8);
    this.leftArm = new THREE.Mesh(armGeo, porcelainMat);
    this.rightArm = new THREE.Mesh(armGeo, porcelainMat);
    this.leftArm.position.set(0.08, 0.78, 0.24);
    this.rightArm.position.set(0.08, 0.78, -0.24);
    this.bodyPivot.add(this.leftArm, this.rightArm);

    // Subtle warm personal key-light so the player is always readable against dark backgrounds
    this.auraLight = new THREE.PointLight(0xffb85c, 1.5, 5.2, 1.8);
    this.auraLight.position.set(0.25, 1.1, 0.65);
    this.group.add(this.auraLight);
  }

  respawn(x, y) {
    this.pos.set(x, y, 0);
    this.vel.set(0, 0, 0);
    this.isDead = false;
    this.isClimbingLedge = false;
    this.isCrouching = false;
    this.isPushing = false;
    this.group.position.copy(this.pos);
  }

  update(dt, input, colliders, pushCrates, hidingZones) {
    if (this.isDead) return;

    // Handle Ledge Climb animation state
    if (this.isClimbingLedge) {
      this.ledgeTimer += dt * 3.1;
      const t = Math.min(1, this.ledgeTimer);
      // Smooth ease-out curve up and over the ledge
      const ease = 1 - Math.pow(1 - t, 3);
      this.pos.x = THREE.MathUtils.lerp(this.ledgeStart.x, this.ledgeEnd.x, ease);
      this.pos.y = THREE.MathUtils.lerp(this.ledgeStart.y, this.ledgeEnd.y, Math.sin(t * Math.PI * 0.5));
      this.vel.set(0, 0, 0);
      if (t >= 1) {
        this.isClimbingLedge = false;
        this.isGrounded = true;
      }
      this.syncMesh(dt, 0);
      return;
    }

    // Horizontal input
    let moveDir = 0;
    if (input.left) moveDir -= 1;
    if (input.right) moveDir += 1;

    // Check if ceiling forces player to stay crouched
    const forceCrouch = this.checkLowCeiling(colliders);
    this.isCrouching = (input.crouch && this.isGrounded) || forceCrouch;
    this.height = this.isCrouching ? 0.85 : 1.45;

    // Check if hiding inside a shadow curtain / alcove
    this.isHiddenInShadow = false;
    for (const hz of hidingZones) {
      if (this.pos.x >= hz.minX && this.pos.x <= hz.maxX && Math.abs(this.pos.y - hz.y) < 1.5) {
        if (this.isCrouching || hz.alwaysHide) {
          this.isHiddenInShadow = true;
        }
      }
    }

    // Crate interaction (Push / Pull when holding E or pushing against crate)
    this.isPushing = false;
    let activeCrate = null;
    for (const crate of pushCrates) {
      const distX = crate.x - this.pos.x;
      const distY = Math.abs(crate.y - this.pos.y);
      if (distY < 0.9 && Math.abs(distX) < crate.halfW + this.width * 0.5 + 0.38) {
        if (input.interact || (moveDir !== 0 && Math.sign(distX) === moveDir)) {
          activeCrate = crate;
          break;
        }
      }
    }

    // Calculate speed
    let maxSpeed = 4.3;
    if (input.sprint && !this.isCrouching && !activeCrate) {
      maxSpeed = 6.2;
    } else if (this.isCrouching) {
      maxSpeed = 2.35;
    } else if (activeCrate) {
      maxSpeed = 2.4;
      this.isPushing = true;
    }

    const targetVx = moveDir * maxSpeed;
    const accel = this.isGrounded ? 18 : 10;
    this.vel.x = THREE.MathUtils.lerp(this.vel.x, targetVx, Math.min(1, dt * accel));

    if (moveDir !== 0 && !activeCrate) {
      this.facing = moveDir;
    } else if (activeCrate) {
      this.facing = Math.sign(activeCrate.x - this.pos.x) || 1;
    }

    // Jump
    if (input.jumpPressed && this.isGrounded && !forceCrouch) {
      this.vel.y = 8.6;
      this.isGrounded = false;
      this.sound.playJump();
      input.jumpPressed = false;
    }

    // Gravity
    this.vel.y -= 22.0 * dt;
    if (this.vel.y < -18) this.vel.y = -18;

    // If pushing/pulling a crate with E or walking into it, move crate first
    if (activeCrate && moveDir !== 0) {
      const crateDelta = this.vel.x * dt;
      const newCrateX = activeCrate.x + crateDelta;
      if (newCrateX >= activeCrate.minX && newCrateX <= activeCrate.maxX) {
        activeCrate.x = newCrateX;
        activeCrate.mesh.position.x = activeCrate.x;
      }
    }

    // Combine static colliders + dynamic crates for collision resolution
    const allColliders = [...colliders];
    for (const c of pushCrates) {
      allColliders.push({
        minX: c.x - c.halfW,
        maxX: c.x + c.halfW,
        minY: c.y,
        maxY: c.y + c.height,
        isCrate: true
      });
    }

    // Move X & resolve collisions
    this.pos.x += this.vel.x * dt;
    this.resolveHorizontalCollisions(allColliders, input, moveDir);

    // Move Y & resolve collisions
    this.pos.y += this.vel.y * dt;
    this.isGrounded = false;
    this.resolveVerticalCollisions(allColliders);

    // Sync 3D character animation
    this.syncMesh(dt, moveDir);
  }

  checkLowCeiling(colliders) {
    const halfW = this.width * 0.42;
    const standTop = this.pos.y + 1.42;
    const crouchTop = this.pos.y + 0.85;
    for (const box of colliders) {
      if (this.pos.x + halfW > box.minX && this.pos.x - halfW < box.maxX) {
        if (box.minY >= crouchTop - 0.05 && box.minY < standTop) {
          return true;
        }
      }
    }
    return false;
  }

  resolveHorizontalCollisions(colliders, input, moveDir) {
    const halfW = this.width * 0.5;
    const playerBottom = this.pos.y + 0.05;
    const playerTop = this.pos.y + this.height - 0.05;

    for (const box of colliders) {
      if (playerTop > box.minY && playerBottom < box.maxY) {
        if (this.pos.x + halfW > box.minX && this.pos.x - halfW < box.maxX) {
          // Check if player can auto-mantle / ledge-climb onto the top of this platform
          const ledgeDiff = box.maxY - this.pos.y;
          if (
            !this.isCrouching &&
            ledgeDiff > 0.25 &&
            ledgeDiff <= 1.55 &&
            (this.vel.y >= -2.5 || input.jumpHeld || moveDir !== 0) &&
            !box.noClimb
          ) {
            // Initiate smooth ledge climb
            this.isClimbingLedge = true;
            this.ledgeTimer = 0;
            this.ledgeStart.copy(this.pos);
            const climbOffset = this.facing > 0 ? 0.42 : -0.42;
            this.ledgeEnd.set(
              this.facing > 0 ? box.minX + climbOffset : box.maxX + climbOffset,
              box.maxY,
              0
            );
            this.sound.playJump();
            return;
          }

          // Standard horizontal push-out
          const overlapLeft = this.pos.x + halfW - box.minX;
          const overlapRight = box.maxX - (this.pos.x - halfW);
          if (overlapLeft < overlapRight) {
            this.pos.x = box.minX - halfW;
          } else {
            this.pos.x = box.maxX + halfW;
          }
          this.vel.x = 0;
        }
      }
    }
  }

  resolveVerticalCollisions(colliders) {
    const halfW = this.width * 0.45;
    for (const box of colliders) {
      if (this.pos.x + halfW > box.minX && this.pos.x - halfW < box.maxX) {
        // Landing on top
        if (this.vel.y <= 0 && this.pos.y <= box.maxY && this.pos.y + 0.45 >= box.maxY) {
          this.pos.y = box.maxY;
          this.vel.y = 0;
          this.isGrounded = true;
          if (box.onRideDeltaX) {
            this.pos.x += box.onRideDeltaX;
          }
        }
        // Hitting head on bottom
        else if (
          this.vel.y > 0 &&
          this.pos.y + this.height >= box.minY &&
          this.pos.y + this.height - 0.45 <= box.minY
        ) {
          this.pos.y = box.minY - this.height;
          this.vel.y = 0;
        }
      }
    }
  }

  syncMesh(dt, moveDir) {
    this.group.position.copy(this.pos);

    // Smoothly rotate character towards facing direction (slight 3/4 angle so both eyes & silhouette read well)
    const targetRotY = this.facing > 0 ? -0.18 : Math.PI + 0.18;
    this.bodyPivot.rotation.y = THREE.MathUtils.lerp(
      this.bodyPivot.rotation.y,
      targetRotY,
      Math.min(1, dt * 12)
    );

    // Crouch scale
    const targetScaleY = this.isCrouching ? 0.62 : 1.0;
    this.bodyPivot.scale.y = THREE.MathUtils.lerp(this.bodyPivot.scale.y, targetScaleY, Math.min(1, dt * 12));

    // Wind-up key on back slowly turns
    this.windKey.rotation.z += dt * (1.2 + Math.abs(this.vel.x) * 0.5);

    // Dim aura light when hidden in shadows
    const targetAura = this.isHiddenInShadow ? 0.45 : 1.55;
    this.auraLight.intensity = THREE.MathUtils.lerp(this.auraLight.intensity, targetAura, Math.min(1, dt * 6));

    // Walk limb animation & footsteps
    const speed = Math.abs(this.vel.x);
    if (this.isGrounded && speed > 0.25) {
      this.walkCycle += dt * speed * 2.8;
      this.stepTimer += dt * speed;
      if (this.stepTimer > 1.35) {
        this.stepTimer = 0;
        const surface = this.pos.x > 66 && this.pos.x < 104 ? 'metal' : 'wood';
        this.sound.playFootstep(surface);
      }

      const swing = Math.sin(this.walkCycle) * 0.55;
      this.leftLeg.rotation.z = swing;
      this.rightLeg.rotation.z = -swing;

      if (this.isPushing) {
        this.leftArm.rotation.z = 0.85;
        this.rightArm.rotation.z = 0.85;
        this.bodyPivot.rotation.z = -this.facing * 0.14;
      } else {
        this.leftArm.rotation.z = -swing * 0.7;
        this.rightArm.rotation.z = swing * 0.7;
        this.bodyPivot.rotation.z = -this.vel.x * 0.025;
      }
      this.bodyPivot.position.y = Math.abs(Math.cos(this.walkCycle)) * 0.045;
    } else {
      this.leftLeg.rotation.z = THREE.MathUtils.lerp(this.leftLeg.rotation.z, 0, dt * 10);
      this.rightLeg.rotation.z = THREE.MathUtils.lerp(this.rightLeg.rotation.z, 0, dt * 10);
      this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, 0, dt * 10);
      this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, 0, dt * 10);
      this.bodyPivot.rotation.z = THREE.MathUtils.lerp(this.bodyPivot.rotation.z, 0, dt * 10);
      this.bodyPivot.position.y = Math.sin(performance.now() * 0.003) * 0.015;
    }
  }
}
