# DAI-091 — Final Compliance

## Status

**IN PROGRESS / BLOCKED ON REPOSITORY VISIBILITY.**

The production runtime itself is frozen and accepted under DAI-099, and DAI-090 unexpected-prompt verification passed without requiring a runtime fix.

Current frozen runtime identity:

- DAI-099 candidate commit:
  `027b0f3f6a5adc648dbff4cd00e28c0abe4778a3`
- runtime-source SHA-256:
  `dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6`
- public demo:
  `https://dungeon-architect-ai.pages.dev/`
- accepted refreshed demo video:
  `59.9 s / 1920×1080 / 30 fps`
- video SHA-256:
  `deaf1b4c1961abc27c7810b88b6af0f83198c9637da997d981c46c7a19bfebf7`

## Official requirement snapshot — checked 2026-09-25

Primary sources:

- Victoria VR build-period announcement:
  https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3
- Victoria VR hackathon announcement:
  https://www.victoriavr.com/news/ai-builder-hackathon-2026-build-the-future-of-ai-native-3d-experiences-5915194b
- Kaggle competition page:
  https://www.kaggle.com/competitions/ai-builder-hackathon-2026

Current requirements relevant to this repository:

- the project must be a working browser-based AI / 3D experience;
- **Public Repo + Browser Demo Required**;
- repository and demo should remain accessible throughout judging;
- third-party libraries/assets/AI-generated materials must comply with applicable licences and be credited where required;
- build period: 2026-09-11 through 2026-11-11;
- final submission deadline: **2026-11-11 16:30 CEST**, equivalent to **2026-11-11 23:30 JST**;
- judging emphasis includes originality, functionality, intelligent interaction, and polished UX.

## Current blocker

As checked on 2026-09-25, `Bonkoturyu/Dungeon-Architect-AI` is still a **Private** GitHub repository.

That is compatible with continuing the build/review process, but it does **not** satisfy the final Public Repo requirement.

Changing repository visibility is intentionally not performed by an automated validation script. The owner must explicitly approve the Private → Public transition.

After visibility is changed, rerun DAI-091 and keep the repository public/accessible through judging.

## Compliance boundary

DAI-091 is documentation / verification work only unless a critical defect is found.

The branch must not change the DAI-099 production runtime-source boundary:

- `apps/editor-slice/`
- `functions/`
- production package `src/` trees used by the browser runtime;
- `spec/dungeon/fixtures/minimal-valid-v1.json`;
- `THIRD_PARTY_NOTICES.txt`;
- `package.json`;
- `package-lock.json`;
- `scripts/build-hosting.mjs`.

If one of those paths changes, the prior DAI-099 runtime freeze is no longer sufficient and a replacement candidate must be built/revalidated/frozen.

## Evidence required

DAI-091 consumes the existing local generated evidence:

- `artifacts/dai-099-freeze/dai-099-freeze-prep.json`
- `artifacts/dai-099-public/dai-099-refreshed-public.json`
- `artifacts/dai-099-video/dai-099-refreshed-demo.mp4`
- `artifacts/dai-090/dai-090-unexpected-prompt-regression.json`
- `artifacts/legal/dai-073-legal-registers.json`
- `artifacts/privacy/dai-074-secret-privacy.json`
- `artifacts/public-docs/dai-080-public-docs.json`
- `artifacts/submission-metadata/dai-083-submission-metadata.json`

These artifacts remain local evidence and are not required to be committed.

## Local validation

From the DAI-091 branch:

```powershell
.\scripts\run-dai-091-final-compliance.ps1
```

The wrapper:

1. installs the exact audited dependencies;
2. runs syntax validation;
3. reruns legal/provenance;
4. reruns secret/privacy;
5. reruns final public-doc truthfulness;
6. reruns submission metadata;
7. runs the DAI-091 aggregate audit;
8. runs `git diff --check`.

Until the GitHub repository is Public, the aggregate audit is expected to fail only the repository-visibility gate.

## Finalization sequence

Once Private → Public is explicitly approved and completed:

1. update the judge-facing docs from “visibility blocker” to “Public confirmed”;
2. rerun DAI-091 on this branch;
3. require `falseChecks: []`;
4. merge the docs/compliance-only PR to `main`;
5. wait for Cloudflare to rebuild the new `main` commit;
6. rerun the refreshed public validation from synchronized `main`;
7. record the final submission commit and rollback point if the commit identity changed;
8. proceed to DAI-092 submission.

Because the final-compliance changes are non-runtime, the runtime-source fingerprint must remain exactly:

`dcdb3518c3a3ca77a3d646a34f5027c65103e82e9ded1929626ad68590596fb6`
