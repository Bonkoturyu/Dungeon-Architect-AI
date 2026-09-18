# AI Usage Register

Record AI services/models/tools used to create production code, documentation, assets, or runtime behavior.

| ID | Tool/Model | Provider | Purpose | Date | Output type | Human review | Terms / evidence | Included in submission | Status |
|---|---|---|---|---|---|---|---|---|---|
| PROD-AI-DEV-001 | ChatGPT / GPT-5.6 Sol | OpenAI | Human-directed production development assistance: implementation, tests, documentation, review, and repository maintenance | 2026-09-12 through 2026-09-18 | source code, tests, Markdown documentation, review suggestions | Yes — user-directed changes plus production Node/Chrome evidence gates before DONE/merge | Hosted development service only; no model weights/runtime redistributed; generated output is reviewed before inclusion | Yes — reviewed source/docs only; raw private chats/prompts are not committed | Recorded |
| PROD-AI-RUN-001 | Responses API / `gpt-5.6-luna` | OpenAI | Production cloud DesignIntent generation and constrained natural-language EditCommand translation | 2026-09-13 onward | schema-constrained structured JSON | Automated independent schema/semantic validation plus user-controlled authoring application | `docs/research/DAI-042_PRODUCTION_CLOUD_PROVIDER_REVIEW_2026-09-13.md`; DAI-043/044/045/053 evidence; requests use `store:false` and server-side credential boundary | Yes — runtime service integration; no model weights are bundled | Approved |

## Boundaries

- No AI-generated image, audio, font, texture, 3D model, animation, or other creative asset is included in the current submission candidate.
- AI development assistance does not bypass project review gates. Production tasks are not marked DONE solely because an AI system generated code or text.
- Runtime model output is not arbitrary executable code. The current production paths accept constrained structured data and independently validate it before use.
- `OPENAI_API_KEY`, account IDs, private chats, and full sensitive prompts must not be stored in this register or the public repository.
- Provider/model selection remains reversible and server-configured; the project does not redistribute OpenAI model weights.

Status values used here: `Recorded` for disclosed development assistance and `Approved` for a reviewed production runtime integration.
