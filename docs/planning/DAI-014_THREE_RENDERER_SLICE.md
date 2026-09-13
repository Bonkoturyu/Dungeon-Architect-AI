# DAI-014 — Minimal Three.js Renderer Adapter: Implementation Brief

## Goal

Render a valid DungeonSpec fixture in a browser using the selected Three.js adapter without importing renderer types into Core.

## First vertical slice

Input:

- renderer-independent `DungeonSpec v1`
- initially use the existing `minimal-valid-v1` fixture and one generated multi-room fixture

Output:

- low-poly room floors/walls
- corridor floors
- visible Start marker
- visible Goal marker
- fixed camera
- resize handling
- disposal/re-render without leaked scene objects

## Boundary

Proposed package:

```text
packages/renderer-three/
├─ src/
│  ├─ scene-plan.js
│  ├─ three-renderer-adapter.js
│  └─ index.js
└─ test/
   └─ scene-plan.test.js
```

`scene-plan.js` remains a plain-data transformation layer. It must not create Three.js objects.

`three-renderer-adapter.js` is the only layer that owns Three.js scene/camera/geometry/material/runtime objects.

Core must not import from `renderer-three`.

## Adapter API draft

```js
createThreeRendererAdapter({ canvas })

adapter.render(spec)
adapter.resize(width, height)
adapter.getObjectBySpecId(id)
adapter.dispose()
```

`render(spec)` must validate/reject an invalid spec before constructing runtime scene state.

## Acceptance

DAI-014 passes when:

- a valid <20-room fixture renders in Chrome,
- rooms and corridors map deterministically from DungeonSpec coordinates,
- Start and Goal are visually distinguishable,
- each runtime object can be traced to a Spec ID where applicable,
- invalid DungeonSpec is rejected,
- dispose + re-render works,
- Core imports zero Three.js symbols/types,
- the pure scene-plan tests pass under Node,
- browser smoke evidence is recorded.

## Explicit non-goals

- final art direction
- asset loading
- combat
- pathfinding
- editor selection UI
- drag/move interaction
- instancing/batching optimization
- WebGPU backend
