# DAI-026 Orthogonal Corridor Presentation

## Status

**IN PROGRESS.** Implemented; production Node + visible-Chrome evidence pending.

## Defect found during DAI-082 capture review

The first DAI-082 capture exposed a presentation defect in generated alternate routes:

- logical alternate edges were rendered as one center-to-center rectangle;
- non-cardinal endpoints therefore created diagonal straight corridors;
- alternate slabs could overlap/cross backbone corridors;
- a room could visually appear to share the same wall opening for multiple logical routes;
- graph reachability was valid, but the rendered result did not read as a coherent dungeon.

The rejected capture is not submission evidence.

## Corrected rendering contract

Logical graph edges remain renderer-independent corridor references.

The Three.js scene planner now routes each corridor as a deterministic axis-aligned polyline:

- no rendered corridor segment may be diagonal;
- routes avoid expanded room interiors;
- routes avoid overlaps/crossings with previously routed corridors;
- backbone routes are planned before alternate routes;
- endpoint doorway sides are kept distinct for a room when degree allows it;
- a logical diagonal edge must visibly bend at right angles;
- straight corridor floor geometry is trimmed at interior bends and each bend receives an explicit square `corridor-junction-*` floor tile, so the rendered walkable surface is continuous without relying on coplanar segment overlap;
- room wall openings come from the selected endpoint doors rather than intersection with one diagonal rectangle;
- camera bounds include the routed corridor path.

This preserves the logical DungeonSpec adjacency while correcting its 3D presentation.

## Regression target

The primary visual regression reproduces the exact public-demo geometry inputs that appeared in the rejected recording:

- Seed: `4171513421`;
- room count: 5;
- routeChoice: `0.55`.

The regression checks:

- all visual segments are axis-aligned;
- every interior right-angle bend has explicit floor coverage at the junction;
- no two routed corridors overlap/cross;
- rooms with degree <= 4 use distinct doorway sides;
- logical diagonal edges have visible bends;
- at least one alternate/diagonal logical route exists in the fixture;
- Chrome emits no console/page/request/HTTP errors.

## Required production validation

```powershell
git fetch origin
git switch fix/dai-026-orthogonal-corridors
git pull --ff-only origin fix/dai-026-orthogonal-corridors
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dai-026-validation.ps1
```

Expected:

- `artifacts/orthogonal-corridors/dai-026-orthogonal-corridors.json`;
- `artifacts/orthogonal-corridors/dai-026-orthogonal-corridors.png`.

## Second visual-review finding

The first orthogonal-routing screenshot still showed a visible black notch at a right-angle bend. The route centerline was continuous, but the acceptance test did not verify rendered floor continuity at the bend.

DAI-026 was therefore tightened again:

- each interior bend now owns a dedicated square floor junction;
- adjoining straight segments are trimmed by half the corridor width so they meet the junction instead of relying on overlapping coplanar boxes;
- Node tests verify one junction floor per interior route point;
- the visible-Chrome smoke now fails when any bend lacks junction coverage.

The screenshot from that first orthogonal attempt is also rejected and must not be used as submission evidence.

## DAI-082 boundary

Do not resume final demo-video recording until:

1. DAI-026 production validation passes;
2. the screenshot is visually reviewed;
3. the fix is merged to main;
4. Cloudflare Pages has redeployed the corrected main;
5. public hosted E2E is rerun against the corrected geometry.

## Non-goals

- changing logical room-graph routeChoice semantics;
- physics-character collision;
- door lock/unlock gameplay;
- final art direction.
