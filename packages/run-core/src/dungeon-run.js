import { validateDungeonSpec } from "../../core/src/dungeon-spec.js";
import {
  createPlayResult,
  startPlaySession
} from "../../play-core/src/play-session.js";

export const DUNGEON_RUN_SPEC_VERSION = "1.0";
export const MAX_DUNGEON_RUN_FLOORS = 10;

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function error(code, path, message) {
  return { code, path, message };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validId(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function validateDungeonRunSpec(spec) {
  const errors = [];

  if (!isRecord(spec)) {
    return {
      valid: false,
      errors: [error("RUN_SPEC_NOT_OBJECT", "$", "DungeonRunSpec must be an object.")]
    };
  }

  if (spec.schemaVersion !== DUNGEON_RUN_SPEC_VERSION) {
    errors.push(error(
      "RUN_SCHEMA_VERSION_UNSUPPORTED",
      "schemaVersion",
      `Expected schemaVersion ${DUNGEON_RUN_SPEC_VERSION}.`
    ));
  }

  if (!validId(spec.id)) {
    errors.push(error("RUN_ID_REQUIRED", "id", "Run ID must be a non-empty string."));
  }

  if (!Array.isArray(spec.floors)) {
    errors.push(error("RUN_FLOORS_ARRAY_REQUIRED", "floors", "floors must be an array."));
    return { valid: false, errors };
  }

  if (spec.floors.length < 1 || spec.floors.length > MAX_DUNGEON_RUN_FLOORS) {
    errors.push(error(
      "RUN_FLOOR_COUNT_INVALID",
      "floors",
      `DungeonRunSpec must contain 1 through ${MAX_DUNGEON_RUN_FLOORS} floors.`
    ));
  }

  const floorIds = new Set();
  const dungeonIds = new Set();

  spec.floors.forEach((floor, index) => {
    const path = `floors[${index}]`;
    if (!isRecord(floor)) {
      errors.push(error("RUN_FLOOR_NOT_OBJECT", path, "Floor must be an object."));
      return;
    }

    if (!validId(floor.id)) {
      errors.push(error("RUN_FLOOR_ID_REQUIRED", `${path}.id`, "Floor ID must be a non-empty string."));
    } else if (floorIds.has(floor.id)) {
      errors.push(error("RUN_FLOOR_ID_DUPLICATE", `${path}.id`, `Duplicate floor ID: ${floor.id}`));
    } else {
      floorIds.add(floor.id);
    }

    const dungeonValidation = validateDungeonSpec(floor.dungeon);
    for (const entry of dungeonValidation.errors) {
      errors.push({
        ...entry,
        path: `${path}.dungeon.${entry.path}`
      });
    }

    const dungeonId = floor.dungeon?.id;
    if (validId(dungeonId)) {
      if (dungeonIds.has(dungeonId)) {
        errors.push(error(
          "RUN_DUNGEON_ID_DUPLICATE",
          `${path}.dungeon.id`,
          `Each floor must use a unique DungeonSpec ID; duplicate: ${dungeonId}`
        ));
      } else {
        dungeonIds.add(dungeonId);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

export function createDungeonRunSpec(dungeons, { id = "dungeon-run" } = {}) {
  if (!Array.isArray(dungeons)) {
    return {
      ok: false,
      spec: null,
      errors: [error("RUN_DUNGEONS_ARRAY_REQUIRED", "dungeons", "dungeons must be an array.")]
    };
  }

  const spec = {
    schemaVersion: DUNGEON_RUN_SPEC_VERSION,
    id,
    floors: dungeons.map((dungeon, index) => ({
      id: `floor-${String(index + 1).padStart(2, "0")}`,
      dungeon: clone(dungeon)
    }))
  };
  const validation = validateDungeonRunSpec(spec);
  if (!validation.valid) return { ok: false, spec: null, errors: validation.errors };
  return { ok: true, spec, errors: [] };
}

function floorResultEntry(run, floorIndex, playResult) {
  return {
    floorIndex,
    floorNumber: floorIndex + 1,
    floorId: run.snapshot.floors[floorIndex].id,
    dungeonId: run.snapshot.floors[floorIndex].dungeon.id,
    result: clone(playResult)
  };
}

export function startDungeonRun(
  authoringRunSpec,
  { startedAt = 0, maxHp, initialPlayerState = null } = {}
) {
  const validation = validateDungeonRunSpec(authoringRunSpec);
  if (!validation.valid) {
    return { ok: false, blocked: true, errors: validation.errors };
  }

  const snapshot = clone(authoringRunSpec);
  const firstDungeon = snapshot.floors[0].dungeon;
  const playOptions = { startedAt };
  if (maxHp !== undefined) playOptions.maxHp = maxHp;
  if (initialPlayerState !== null) playOptions.initialPlayerState = initialPlayerState;

  const started = startPlaySession(firstDungeon, playOptions);
  if (!started.ok) {
    return {
      ok: false,
      blocked: true,
      errors: (started.errors ?? []).map((entry) => ({
        ...entry,
        path: `floors[0].dungeon.${entry.path}`
      }))
    };
  }

  return {
    ok: true,
    blocked: false,
    run: {
      schemaVersion: "1.0",
      runId: snapshot.id,
      snapshot,
      status: "playing",
      failureReason: null,
      startedAt,
      completedAt: null,
      currentFloorIndex: 0,
      floorCount: snapshot.floors.length,
      currentFloorSession: clone(started.session),
      floorResults: [],
      playerState: clone(started.session.playerState),
      events: [{
        type: "floor-started",
        floorIndex: 0,
        floorNumber: 1,
        floorId: snapshot.floors[0].id,
        dungeonId: firstDungeon.id,
        at: startedAt
      }]
    }
  };
}

export function syncDungeonRunFloor(
  run,
  floorSession,
  { at = floorSession?.completedAt ?? run?.startedAt ?? 0 } = {}
) {
  if (!run || run.status !== "playing") {
    return { ok: false, error: error("RUN_NOT_PLAYING", "$", "Dungeon run is not in playing state.") };
  }
  if (!floorSession || !isRecord(floorSession)) {
    return { ok: false, error: error("RUN_FLOOR_SESSION_REQUIRED", "floorSession", "floorSession is required.") };
  }

  const expectedFloor = run.snapshot?.floors?.[run.currentFloorIndex];
  if (!expectedFloor) {
    return { ok: false, error: error("RUN_CURRENT_FLOOR_MISSING", "currentFloorIndex", "Current floor is missing.") };
  }
  if (floorSession.dungeonId !== expectedFloor.dungeon.id) {
    return {
      ok: false,
      error: error(
        "RUN_FLOOR_SESSION_MISMATCH",
        "floorSession.dungeonId",
        `Expected ${expectedFloor.dungeon.id}, received ${String(floorSession.dungeonId)}.`
      )
    };
  }

  const next = clone(run);
  next.currentFloorSession = clone(floorSession);
  next.playerState = clone(floorSession.playerState);

  if (floorSession.status === "playing") {
    return { ok: true, run: next, advanced: false, finished: false };
  }

  const playResult = createPlayResult(floorSession);
  if (!playResult.ok) {
    return { ok: false, error: error("RUN_FLOOR_RESULT_INVALID", "floorSession", playResult.error.message) };
  }

  next.floorResults.push(floorResultEntry(next, next.currentFloorIndex, playResult.result));

  if (floorSession.status === "failed") {
    next.status = "failed";
    next.failureReason = floorSession.failureReason ?? "progression-blocked";
    next.completedAt = at;
    next.events.push({
      type: "run-failed",
      floorIndex: next.currentFloorIndex,
      floorNumber: next.currentFloorIndex + 1,
      floorId: expectedFloor.id,
      reason: next.failureReason,
      at
    });
    return { ok: true, run: next, advanced: false, finished: true };
  }

  next.events.push({
    type: "floor-cleared",
    floorIndex: next.currentFloorIndex,
    floorNumber: next.currentFloorIndex + 1,
    floorId: expectedFloor.id,
    dungeonId: expectedFloor.dungeon.id,
    at
  });

  const nextFloorIndex = next.currentFloorIndex + 1;
  if (nextFloorIndex >= next.floorCount) {
    next.status = "cleared";
    next.failureReason = null;
    next.completedAt = at;
    next.events.push({ type: "run-cleared", floorCount: next.floorCount, at });
    return { ok: true, run: next, advanced: false, finished: true };
  }

  const nextFloor = next.snapshot.floors[nextFloorIndex];
  const started = startPlaySession(nextFloor.dungeon, {
    startedAt: at,
    initialPlayerState: floorSession.playerState
  });
  if (!started.ok) {
    return {
      ok: false,
      error: error(
        "RUN_NEXT_FLOOR_START_FAILED",
        `snapshot.floors[${nextFloorIndex}]`,
        JSON.stringify(started.errors ?? [])
      )
    };
  }

  next.currentFloorIndex = nextFloorIndex;
  next.currentFloorSession = clone(started.session);
  next.playerState = clone(started.session.playerState);
  next.events.push({
    type: "floor-started",
    floorIndex: nextFloorIndex,
    floorNumber: nextFloorIndex + 1,
    floorId: nextFloor.id,
    dungeonId: nextFloor.dungeon.id,
    at
  });

  return { ok: true, run: next, advanced: true, finished: false };
}

export function createDungeonRunResult(run) {
  if (!run || !["cleared", "failed"].includes(run.status)) {
    return {
      ok: false,
      error: error("RUN_NOT_FINISHED", "$", "Dungeon run must be cleared or failed.")
    };
  }

  return {
    ok: true,
    result: {
      schemaVersion: "1.0",
      runId: run.runId,
      status: run.status,
      failureReason: run.status === "failed" ? run.failureReason ?? null : null,
      floorCount: run.floorCount,
      floorsCompleted: run.floorResults.length,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      elapsed: run.completedAt - run.startedAt,
      currentFloorIndex: run.currentFloorIndex,
      finalPlayerState: clone(run.playerState),
      floorResults: clone(run.floorResults)
    }
  };
}
