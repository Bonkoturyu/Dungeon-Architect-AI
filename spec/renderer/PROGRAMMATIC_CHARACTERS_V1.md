# Programmatic Characters v1

## Purpose

DAI-096 replaces abstract runtime Player/Enemy pins with project-authored low-poly character silhouettes built entirely from Three.js primitives.

No external model, texture, animation, or creative asset is required.

## Boundary

The character definition layer is renderer-friendly plain data.

`programmatic-characters.js` decides:

- which primitive parts form a Player or Enemy;
- relative transforms;
- semantic material roles;
- Level and equipment-dependent Player parts.

The Three.js adapter only converts those definitions into geometry/material instances.

This keeps presentation deterministic and testable without WebGL.

## Player

The runtime Player is not serialized into DungeonSpec.

The adapter creates one runtime-only Player group in the current Play/Result room.

Base silhouette:

- two boots;
- two legs;
- torso;
- head;
- two arms;
- crest.

Progression presentation:

- Level may increase body scale slightly, capped to keep the silhouette stable;
- equipped Weapon adds a blade and guard;
- equipped Armor changes torso/arm material and adds two pauldrons.

The runtime Player does not enter the Spec-ID selection map and therefore cannot replace or collide with authored entity IDs.

## Enemy

Each visible active Enemy keeps its authored Enemy Spec ID but is rendered as a multi-part low-poly creature instead of the old single Octahedron marker.

Silhouette:

- feet;
- legs;
- torso;
- head;
- arms;
- two horns;
- face plate.

Existing runtime visibility rules remain authoritative:

- dormant Enemy hidden;
- active Enemy visible;
- defeated Enemy hidden;
- unexplored-room Enemy hidden.

## Determinism

The same character input produces byte-equivalent plain-data definitions.

Character version is frozen as `PROGRAMMATIC_CHARACTER_VERSION = "1"`.

Future silhouette changes that would materially alter the accepted presentation should either preserve v1 compatibility or introduce a new explicit version.

## Materials

All colors are project-authored constants.

Player roles:

- body;
- accent;
- skin;
- boot;
- weapon;
- armor.

Enemy roles:

- body;
- skin;
- dark detail;
- horn.

No image texture or external material asset is used.

## Runtime integration

The editor passes to the renderer:

- exploration visibility;
- current runtime entity states;
- `showPlayer` in Play/Result;
- current PlayerState.

The renderer exposes a diagnostic presentation summary for automated/browser acceptance:

- Player room;
- Player part names;
- equipment tiers;
- Level;
- currently rendered Enemy IDs and part names.

This summary is test-only/diagnostic state; Play rules remain owned by Play Core.
