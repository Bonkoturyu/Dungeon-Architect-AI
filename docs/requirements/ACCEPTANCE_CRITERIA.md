# Acceptance Criteria

## MVP end-to-end

A judge can:

1. Open the hosted browser demo.
2. Enter a natural-language dungeon request.
3. Receive a generated low-poly 3D dungeon and supported working logic.
4. Edit at least one structural/gameplay element.
5. Perform at least one natural-language edit.
6. Run validation.
7. Be blocked from START if a Critical validation error exists.
8. Press START on a valid dungeon.
9. Play from Start to Goal.
10. Reach a Result / Reveal screen.

## Validation

Critical checks include:

- Start→Goal reachability
- broken entity/reference detection
- invalid spatial connection
- required objective availability
- supported event-reference integrity
- soft-lock class failures
- edit-state consistency

## Safety/fairness defaults

- unavoidable instant death is not used as an MVP default
- required-path hazards should have avoidance/mitigation/telegraph where applicable
- failure reason should be understandable on retry/result
- RNG alone must not determine the only valid route

## Engineering invariants

- renderer-independent DungeonSpec
- runtime/editor state separation
- execution snapshot on START
- schema-validated LLM output
- reproducible Seed within schema/version
- no secret/private data in public build/repo
