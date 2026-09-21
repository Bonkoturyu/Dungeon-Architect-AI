# Editor UI/UX Review — 2026-09-21

## Purpose

This document records the UI/UX design basis for the Dungeon Architect AI desktop editor and the owner review changes accepted on 2026-09-21.

The editor is an AI-first authoring tool. Its right-side information hierarchy is therefore intentionally:

1. **Goal Check**
2. **Mode Actions** — Create / Edit / Play
3. **AI Request**
4. **Inspector** — Entities / Rooms / Corridors

The inspector uses tabs rather than three continuously stacked panels. Selecting a Room, Entity, or Corridor in the 3D view or inspector automatically activates the matching inspector tab.

## Primary-source design references

### WCAG 2.2 — target size

W3C WCAG 2.2 Success Criterion 2.5.8 states that pointer targets should be at least **24 × 24 CSS px**, subject to documented exceptions, and explains that sufficient target size / spacing reduces accidental activation.

Primary source:

- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

Project decision:

- ordinary editor controls target **40 px minimum height**;
- primary actions target **44 px minimum height**;
- small chips remain at least 28–32 px tall and are not used as the only path to essential actions.

### WCAG 2.2 — resize text

W3C WCAG 2.2 Success Criterion 1.4.4 requires text to remain usable when resized up to **200%** without loss of content or functionality.

Primary source:

- https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html

Project decision:

- body/control text is raised to approximately **15–16 px**;
- helper/caption text is raised to approximately **13–14 px**;
- section titles are approximately **17–18 px**;
- layouts use flexible dimensions and scrolling rather than depending on very small text.

### U.S. Web Design System — spacing units

USWDS spacing tokens are based primarily on **8 px multiples**, with smaller intermediate tokens where useful.

Primary source:

- https://designsystem.digital.gov/design-tokens/spacing-units/

Project decision:

- primary spacing scale: **8 / 12 / 16 / 24 / 32 px**;
- card padding: generally **16 px**;
- form/control gaps: generally **12 px**;
- major panel gaps: generally **16 px**.

### U.S. Web Design System — buttons

USWDS describes buttons as important actions with a **large selectable surface**.

Primary source:

- https://designsystem.digital.gov/components/button/

Project decision:

- important buttons receive 40–44 px control height;
- destructive actions remain visually differentiated;
- disabled state is retained, but important actions remain legible when enabled.

### Material Design 3 / Apple Human Interface Guidelines

Additional official references were reviewed for layout, spacing, typography, and control sizing:

- https://m3.material.io/foundations/layout/grids-spacing/spacing
- https://m3.material.io/foundations/typography/overview
- https://m3.material.io/components/buttons/specs
- https://developer.apple.com/design/human-interface-guidelines/layout
- https://developer.apple.com/design/human-interface-guidelines/typography

These are supporting references; the explicit measurable acceptance gates in this project are derived from the W3C / USWDS sources above.

## Accepted editor layout decisions

### Viewport HUD

Left-side order:

1. **Legend**
2. **Selected**

Rationale:

- Legend is stable reference information and should be visually predictable.
- Selected is contextual information and follows the stable reference.
- Both are grouped into a single vertical HUD stack to avoid brittle hard-coded absolute offsets.

Room Contents remains at the upper-right of the 3D viewport.

### Sidebar hierarchy

The AI-first workflow remains visible and prioritized:

1. Goal Check
2. Create / Edit / Play mode actions
3. AI Request when Edit is active
4. Inspector tabs

The prior proposal to move Rooms/Corridors above AI Request is explicitly rejected.

### Inspector behavior

Inspector tabs:

- Entities
- Rooms
- Corridors

Automatic switching:

- selecting a 3D/entity item → Entities;
- selecting a room → Rooms;
- selecting a corridor → Corridors;
- adding a room → Rooms;
- adding a corridor → Corridors.

Manual tab switching remains possible and does not change selection.

## Direct 3D authoring controls

The owner review replaces the previous left-drag orbit interaction with an editor-oriented mouse model:

- **Left click**: select Room / Entity / Corridor when the pointer is released without a meaningful drag.
- **Left drag on empty/floor space**: pan the camera across large dungeons.
- **Right drag**: orbit / rotate the 3D camera.
- **Mouse wheel**: zoom.
- **Left drag from a selected Room wall**: begin a temporary Corridor draft.
- If the drafted Corridor reaches another Room, the target becomes a valid connection candidate.
- Releasing without reaching a Room cancels the draft without modifying DungeonSpec.
- Collision with an existing Corridor / invalid target produces an error instead of silently creating invalid geometry.
- Dragging from an existing Corridor endpoint temporarily replaces its rendered Corridor with the draft appearance; successful release reconnects the same Corridor ID as one undoable edit.

Result/Play summary alignment:

- the header mode badge label is visually centered inside its pill while the status dot is positioned independently;
- the Play/Result summary row centers the mode label together with MOVE/MAP metrics within the floating result card;
- the result banner and result metrics remain centered below that summary row.

The temporary Corridor uses distinct visual states:

- cyan: drafting / no Room reached yet;
- green: **final scene-plan preflight succeeded** and releasing the mouse will commit the same routed Corridor;
- red: duplicate / invalid connection / final scene-plan routing failure.

The green state is therefore not a loose proximity hint. The editor builds the actual add/reconnect edit command, runs the same `createDungeonScenePlan()` routing preflight used for commit, and renders the resulting final route as the temporary Corridor. This prevents a green preview from turning into a routing error on mouse release.

Target-side semantics:

- direct 3D drag always keeps the **target doorway side Auto**, regardless of which target Room surface the camera ray happens to hit;
- the source wall remains explicit because Corridor drafting starts from the wall the user dragged;
- users who want to pin the target doorway to North/East/South/West can do so afterward in the Corridor inspector.

This deliberately avoids treating a perspective-dependent wall hit as user intent. A Room that visually looks like the drop target must not accidentally receive a fixed target wall merely because the camera ray intersected that wall before the floor.

Room creation in the inspector uses four direct cardinal action buttons rather than a direction dropdown followed by a separate Add action.

Room creation and movement follow selection context:

- when a Room is selected, a compass-style North / East / South / West control adds a Room relative to that selected Room;
- when no Room is selected, a single action adds a Room near the center of the current 3D view, searching nearby positions until it finds non-overlapping space;
- a newly added Room becomes selected immediately;
- a selected Room with **no connected Corridors** can be left-dragged from its floor to an arbitrary free position;
- connected Rooms are not freely dragged by mouse, avoiding accidental topology distortion;
- dragging an isolated Room into another Room shows a blocked preview and does not commit the move;
- wall dragging always takes precedence over Room dragging because it is the direct Corridor creation gesture.

Corridor targeting uses the actual object under the pointer. When the cursor is over a Room or an Entity contained by a Room, that Room is treated as the intended connection target even if the camera perspective makes its ground-plane projection fall outside the Room footprint. Final Corridor creation still passes renderer preflight before commit.

## Layout-not-renderable feedback

Internal renderer/preflight failures must not be presented as only `LAYOUT_NOT_RENDERABLE`.

User-facing feedback for a failed room move must state:

- what failed;
- that corridor geometry could not be rebuilt cleanly at the requested position;
- recovery actions: move an adjacent room, change corridor doorway sides, or remove/recreate the affected corridor.

The internal status code may remain available in diagnostic evidence, but should not be the primary explanation shown to the user.

## Corridor-routing resilience

The renderer should prefer centered doorway placement but may shift a doorway along the selected wall when the centered point is blocked. This keeps the user-selected North/East/South/West wall preference while avoiding unnecessary room-move rejection.

Existing route behavior remains deterministic and centered when the centered route is valid.

## Acceptance checks

At 1440 × 900 desktop Chrome:

- Legend appears above Selected.
- Goal Check is the first sidebar card.
- Mode Actions are second.
- AI Request is the first Edit-mode content panel.
- Inspector tabs follow AI Request.
- Room/Entity/Corridor selections auto-activate the corresponding inspector tab.
- Control heights are at least 40 px for ordinary controls and 44 px for primary actions.
- Helper/body text is materially larger than the pre-review UI.
- the editor remains usable with browser zoom / larger text;
- the owner-review smoke remains green;
- the previously reproduced Goal-room upward move is not rejected solely by corridor-center routing.
