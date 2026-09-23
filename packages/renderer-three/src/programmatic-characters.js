export const PROGRAMMATIC_CHARACTER_VERSION = "1";

export const DEFAULT_CHARACTER_COLORS = Object.freeze({
  playerBody: 0x38bdf8,
  playerAccent: 0xfacc15,
  playerSkin: 0xf1c7a5,
  playerBoot: 0x334155,
  playerWeapon: 0xdbeafe,
  playerArmor: 0x64748b,
  enemyBody: 0x991b1b,
  enemySkin: 0xef4444,
  enemyDark: 0x3f0d12,
  enemyHorn: 0xf59e0b
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function part(name, primitive, position, scale, materialRole, {
  rotation = null,
  segments = null
} = {}) {
  return {
    name,
    primitive,
    position: { ...position },
    scale: { ...scale },
    materialRole,
    ...(rotation ? { rotation: { ...rotation } } : {}),
    ...(segments ? { segments: { ...segments } } : {})
  };
}

function assertGroundPosition(position, label) {
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    throw new TypeError(`${label} position must contain finite x/y/z values.`);
  }
}

function equipmentTier(playerState, slot) {
  const item = playerState?.equipment?.[slot] ?? null;
  return Number.isSafeInteger(item?.tier) && item.tier > 0 ? item.tier : 0;
}

export function createPlayerCharacterDefinition({
  position,
  roomId,
  playerState = null
} = {}) {
  assertGroundPosition(position, "player");
  if (typeof roomId !== "string" || roomId.trim() === "") {
    throw new TypeError("player roomId must be a non-empty string.");
  }

  const weaponTier = equipmentTier(playerState, "weapon");
  const armorTier = equipmentTier(playerState, "armor");
  const level = Number.isSafeInteger(playerState?.level) && playerState.level > 0
    ? playerState.level
    : 1;

  const scaleBoost = Math.min(0.12, Math.max(0, level - 1) * 0.012);
  const bodyWidth = 0.58 + scaleBoost;
  const bodyHeight = 0.74 + scaleBoost;

  const parts = [
    part("left-boot", "box", { x: -0.18, y: 0.13, z: 0 }, { x: 0.23, y: 0.26, z: 0.34 }, "playerBoot"),
    part("right-boot", "box", { x: 0.18, y: 0.13, z: 0 }, { x: 0.23, y: 0.26, z: 0.34 }, "playerBoot"),
    part("left-leg", "box", { x: -0.17, y: 0.43, z: 0 }, { x: 0.2, y: 0.43, z: 0.22 }, "playerBody"),
    part("right-leg", "box", { x: 0.17, y: 0.43, z: 0 }, { x: 0.2, y: 0.43, z: 0.22 }, "playerBody"),
    part("torso", "box", { x: 0, y: 0.93, z: 0 }, { x: bodyWidth, y: bodyHeight, z: 0.38 }, armorTier > 0 ? "playerArmor" : "playerBody"),
    part("head", "sphere", { x: 0, y: 1.52, z: 0 }, { x: 0.38, y: 0.42, z: 0.38 }, "playerSkin", {
      segments: { width: 8, height: 6 }
    }),
    part("left-arm", "box", { x: -0.42, y: 0.97, z: 0 }, { x: 0.18, y: 0.62, z: 0.2 }, armorTier > 0 ? "playerArmor" : "playerBody", {
      rotation: { x: 0, y: 0, z: -0.12 }
    }),
    part("right-arm", "box", { x: 0.42, y: 0.97, z: 0 }, { x: 0.18, y: 0.62, z: 0.2 }, armorTier > 0 ? "playerArmor" : "playerBody", {
      rotation: { x: 0, y: 0, z: 0.12 }
    }),
    part("crest", "cone", { x: 0, y: 1.91, z: 0 }, { x: 0.22, y: 0.32, z: 0.22 }, "playerAccent", {
      segments: { radial: 5 }
    })
  ];

  if (armorTier > 0) {
    const shoulderScale = 0.24 + Math.min(0.08, armorTier * 0.02);
    parts.push(
      part("left-pauldron", "sphere", { x: -0.39, y: 1.22, z: 0 }, {
        x: shoulderScale,
        y: 0.18,
        z: 0.28
      }, "playerArmor", { segments: { width: 6, height: 4 } }),
      part("right-pauldron", "sphere", { x: 0.39, y: 1.22, z: 0 }, {
        x: shoulderScale,
        y: 0.18,
        z: 0.28
      }, "playerArmor", { segments: { width: 6, height: 4 } })
    );
  }

  if (weaponTier > 0) {
    const bladeLength = 0.72 + Math.min(0.28, weaponTier * 0.07);
    parts.push(
      part("weapon-blade", "box", { x: 0.6, y: 0.95, z: -0.03 }, {
        x: 0.08,
        y: bladeLength,
        z: 0.08
      }, "playerWeapon", {
        rotation: { x: 0, y: 0, z: -0.42 }
      }),
      part("weapon-guard", "box", { x: 0.48, y: 0.7, z: -0.03 }, {
        x: 0.32,
        y: 0.07,
        z: 0.09
      }, "playerAccent", {
        rotation: { x: 0, y: 0, z: -0.42 }
      })
    );
  }

  return {
    version: PROGRAMMATIC_CHARACTER_VERSION,
    kind: "player-character",
    roomId,
    position: clone(position),
    equipment: {
      weaponTier,
      armorTier
    },
    level,
    parts
  };
}

export function createEnemyCharacterDefinition(marker) {
  if (!marker || marker.type !== "enemy") {
    throw new TypeError("enemy character definition requires an enemy marker.");
  }
  assertGroundPosition(marker.position, "enemy marker");

  const groundY = marker.position.y - (Number.isFinite(marker.height) ? marker.height / 2 : 0);
  const position = {
    x: marker.position.x,
    y: groundY,
    z: marker.position.z
  };

  return {
    version: PROGRAMMATIC_CHARACTER_VERSION,
    kind: "enemy-character",
    specId: marker.specId,
    roomId: marker.roomId,
    position,
    parts: [
      part("left-foot", "box", { x: -0.2, y: 0.12, z: 0.03 }, { x: 0.26, y: 0.24, z: 0.4 }, "enemyDark"),
      part("right-foot", "box", { x: 0.2, y: 0.12, z: 0.03 }, { x: 0.26, y: 0.24, z: 0.4 }, "enemyDark"),
      part("left-leg", "box", { x: -0.18, y: 0.43, z: 0 }, { x: 0.22, y: 0.46, z: 0.24 }, "enemyBody"),
      part("right-leg", "box", { x: 0.18, y: 0.43, z: 0 }, { x: 0.22, y: 0.46, z: 0.24 }, "enemyBody"),
      part("torso", "box", { x: 0, y: 0.96, z: 0 }, { x: 0.72, y: 0.78, z: 0.44 }, "enemyBody"),
      part("head", "sphere", { x: 0, y: 1.56, z: 0 }, { x: 0.46, y: 0.43, z: 0.43 }, "enemySkin", {
        segments: { width: 7, height: 5 }
      }),
      part("left-arm", "box", { x: -0.5, y: 1.0, z: 0 }, { x: 0.2, y: 0.68, z: 0.22 }, "enemySkin", {
        rotation: { x: 0, y: 0, z: -0.18 }
      }),
      part("right-arm", "box", { x: 0.5, y: 1.0, z: 0 }, { x: 0.2, y: 0.68, z: 0.22 }, "enemySkin", {
        rotation: { x: 0, y: 0, z: 0.18 }
      }),
      part("left-horn", "cone", { x: -0.24, y: 1.96, z: 0 }, { x: 0.16, y: 0.38, z: 0.16 }, "enemyHorn", {
        rotation: { x: 0, y: 0, z: 0.25 },
        segments: { radial: 5 }
      }),
      part("right-horn", "cone", { x: 0.24, y: 1.96, z: 0 }, { x: 0.16, y: 0.38, z: 0.16 }, "enemyHorn", {
        rotation: { x: 0, y: 0, z: -0.25 },
        segments: { radial: 5 }
      }),
      part("face", "box", { x: 0, y: 1.5, z: 0.39 }, { x: 0.28, y: 0.13, z: 0.06 }, "enemyDark")
    ]
  };
}
