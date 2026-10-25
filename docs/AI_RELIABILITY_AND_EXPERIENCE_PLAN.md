# OHMI — AI Reliability & Interactive Learning Experience Upgrade Plan
Date: 26 October 2026
Author: Antigravity (Implementation Worker)

## 1. Problem Statement & Root Cause Evidence

### Issue 1: Ask OHMI — Incomplete AI Answers & Truncation
- **Root Cause A**: Output limit was constrained to 1536 tokens for chat in `supabase/functions/ohmi-ai/handler.ts`. With Groq `openai/gpt-oss-120b`, `reasoning_effort: 'low'` consumes completion tokens, leaving fewer than 1000 tokens for technical circuit calculations and LaTeX formatting.
- **Root Cause B**: When `MAX_TOKENS` or `length` finish reason occurs, `handler.ts` appends a raw system message `[Answer incomplete: the output token limit was reached. Continue the answer to see the remaining explanation.]` directly into `ohmi_messages.content`.
- **Root Cause C**: Truncating in the middle of LaTeX math (e.g. `$R_p = \dots =`) leaves unclosed `$` delimiters, causing `remark-math` and `rehype-katex` to fail and display raw unparsed LaTeX.
- **Root Cause D**: The prompt in `handler.ts` for PDF operations unconditionally appends "Please analyze this electronics assignment PDF. Identify the main learning objective...", even for continuations or specific student calculation questions.
- **Root Cause E**: Continuation inserts a clunky user prompt into the chat history, and the model repeats previously completed sections instead of cleanly continuing from the exact stopping point.

### Issue 2: Step-by-Step Guide — Replace Text-Heavy Results with Interactive Your Path
- **Root Cause A**: Disconnected components in `web-app/src/components/guide.tsx`. `<SavedGuides>` rendered a separate accordion of raw text above `<div className="guide-layout">`, which remained permanently bound to the static 5-step beginner LED tutorial from `@/lib/content`.
- **Root Cause B**: No unified guide selection model in app state. Generated guides were not wired to drive "Your Path" (sidebar step list, progress bar, step details, building blocks, navigation).
- **Root Cause C**: `CircuitDiagram` in `circuit-diagram.tsx` was a hardcoded single-circuit SVG. There was no dynamic visual or component presentation for assignment-generated guides.
- **Root Cause D**: Checkboxes in `SavedGuide` were primitive HTML inputs in a vertical dump, rather than integrated into the interactive step cards with saved progress per guide.

### Issue 3: Circuit Checker — Failed Analysis Requests
- **Root Cause A**: Error masking in `web-app/src/lib/backend/ai.ts`: when a POST request failed, the catch block invoked `lookup()`, which found `status: 'failed'` in the database and threw the generic error `"This request failed. You can submit a new attempt when ready."`, wiping out the real server error message.
- **Root Cause B**: Unsupported `anyOf` in Gemini structured output schema (`circuitResponseSchema` in `supabase/functions/ohmi-ai/schemas.ts`). Gemini structured output ignores or malforms `anyOf` unions, omitting `kind`.
- **Root Cause C**: Brittle validator in `circuit.ts`: `validateEvidenceReference` threw when `r.kind` was undefined, even when the object contained obvious fields like `imageId` and `location`.
- **Root Cause D**: Missing prompt guidance on complex breadboard / Arduino circuit visual patterns.

---

## 2. Proposed Architectural Changes & Solutions

### A. Ask OHMI — Smart Token Allocation & Seamless Continuation
1. **Increase & Balance Output Token Budgets Safely**:
   - For `chat` with calculation/code: upgrade `maxTokens` from 1536 to 2560 for Groq text chat (well within Groq TPM limit of 6400 and lease timeout).
   - For `pdf` and `image` operations on Gemini: maintain 3072 / 2048 output tokens.
2. **Clean Math & Content Sanitization on Truncation**:
   - If an answer ends with unclosed inline math (`$`) or display math (`$$`) or unclosed code blocks (```), gracefully close the block so KaTeX and Markdown render cleanly.
   - Do NOT append raw bracketed system messages to the text payload. Instead, return `incomplete: true` in the structured result metadata.
3. **First-Class "Continue Answer" UI & Context Preservation**:
   - Display a dedicated, styled mint-green **Continue Answer** action banner at the end of the incomplete assistant message.
   - When clicked, continue from where it stopped. Send a targeted continuation prompt with `continuation: { operation, assignmentId, ... }` and stopping context, instruct the tutor explicitly to resume from the incomplete section without repeating completed derivations.
   - In `handler.ts`, avoid appending the full generic "Please analyze this PDF..." instruction when a continuation or specific question is being answered.

### B. Step-by-Step Guide — Interactive "Your Path" Integration
1. **Unify Guide State**:
   - In `web-app/src/components/guide.tsx`, create an active guide state: either the built-in "Beginner: Simple LED Circuit" or any saved assignment guide (`app.analyses` where `artifact_kind === 'tutorial'`).
   - Add a clean, accessible guide selector/switcher at the top ("Beginner LED Circuit" | saved assignment guides | "Generate new guide").
2. **Populate "Your Path" with Assignment Steps**:
   - When an assignment guide is active, "Your Path" displays the assignment's title, objective, building blocks (from `components`), and steps (from `steps`).
   - The sidebar shows the full step navigation list with completion checkmarks, progress percentage, and active step highlighting.
3. **Interactive Step View**:
   - Step header: "Step X of Y", step title, short objective.
   - Visual: Display a relevant component illustration (e.g. Arduino Uno, Breadboard, Resistor, LED, Pushbutton from `web-app/public/library/`) or schematic diagram template.
   - Practical instructions in clear readable steps.
   - Expandable "Why does this work?" explanation box for deeper understanding.
   - Formula / calculation breakdown if numerical values are involved.
   - Syntax-highlighted Arduino code block if code is required.
   - Checkpoint box: "I completed this step" checkbox that updates progress via `app.saveProgress(analysis.id, stepIndex, completedSteps)`.
   - Previous / Next step navigation buttons with keyboard/touch support.
4. **Separate Progress Per Guide**:
   - Built-in LED guide progress is tracked in `app.completed`.
   - Assignment guide progress is tracked per `analysis.id` in `app.savedProgress`.

### C. Circuit Checker — Resilient Evidence & Actionable Recovery
1. **Fix Error Masking in `askBackend()`**:
   - In `web-app/src/lib/backend/ai.ts`, if POST receives an HTTP error (e.g. 400 or 502 with error details), throw the real server error directly instead of overwriting it with the generic `lookup()` failure.
   - Only invoke `lookup()` if an actual network disconnection or AbortError occurs.
2. **Flatten Evidence Schema for Gemini**:
   - In `supabase/functions/ohmi-ai/schemas.ts`, replace `{ anyOf: variants }` with a flat evidence object schema that Gemini reliably supports without dropping properties.
3. **Resilient Evidence Reference Validation**:
   - In `supabase/functions/ohmi-ai/circuit.ts`, infer `kind` if missing or misnamed (e.g., if `imageId` or `location` exists, infer `kind = 'image'`). Normalize before validation.
4. **Hardened Prompting for Complex Arduino / Breadboard Circuits**:
   - Explicit instructions in `buildCircuitPrompt` for breadboards, Arduino pin tracing, and honest limitations.

---

## 3. Files Requiring Modification

| File | Changes |
|---|---|
| `supabase/functions/ohmi-ai/handler.ts` | Output token limits, math delimiter closing on truncation, continuation prompt clean-up |
| `supabase/functions/ohmi-ai/schemas.ts` | Flatten `circuitResponseSchema` evidence list to avoid `anyOf` for Gemini |
| `supabase/functions/ohmi-ai/circuit.ts` | Normalize evidence reference discriminant `kind` from properties |
| `web-app/src/lib/backend/ai.ts` | Fix error masking in `askBackend()` so actionable errors surface |
| `web-app/src/components/chat.tsx` | Dedicated Continue Answer UI action, smooth continuation flow, math formatting |
| `web-app/src/components/guide.tsx` | Full interactive Your Path integration for AI-generated guides |
| `web-app/src/components/saved-guides.tsx` | Refactor into guide manager / generator that switches the active Your Path guide |
| `web-app/src/components/circuit-diagram.tsx` | Dynamic visual representation supporting component illustrations and schematics |
| `vitest.config.ts` & `tests/ai-provider-evaluation.test.ts` | Test harness isolation and test fixes |

---

## 4. Resource Limits & Quotas
- Free tier budget remains ₱0.
- No changes to billing or provider credentials.
- Groq TPM (6400) and RPM (24) respected. Chat `maxTokens` set to 2560 (leaves ample margin).
- Gemini TPM (32000) and RPM (12) respected.

---

## 5. Rollback Strategy
- All changes are code-level in the frontend PWA and Supabase Edge functions.
- No destructive database migrations or schema alterations required.
- Git revert or branch rollback restores previous commit `d7de6bd` cleanly.
