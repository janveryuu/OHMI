# OHMI AI Provider Readiness & Account Baseline

**Date:** 25 October 2026  
**Scope:** OHMI Backend AI Integration (Edge Functions & Database)

## 1. Backend Baseline & Hosted Infrastructure
- **Hosted Supabase Project:** `vhmdgfydvoljzqztuxmu` (Seoul `ap-northeast-2`), ACTIVE_HEALTHY.
- **Edge Functions:**
  - `ohmi-ai`: Monolithic legacy bundle v14 (scheduled for upgrade to shared policy handler).
  - `ohmi-web`: v6, imports shared `ohmi-ai/handler.ts` and `/guide` curated library.
- **Database:** 15 hosted migrations, dual `ohmi_reserve_ai` overloads (8 and 9 args), `ohmi_complete_ai`, `ohmi_fail_ai`.
- **Baseline Test Suite:** Passed (282/282 root/extension unit/integration tests; 39/39 web-app tests).

## 2. Provider Account & Model Specifications

### GroqCloud (Conversational Ask OHMI)
- **Endpoint:** `https://api.groq.com/openai/v1/chat/completions` (Fixed; no user-configurable base URL).
- **Authentication:** `Authorization: Bearer $GROQ_API_KEY` (Supabase secret).
- **Candidates:**
  - `openai/gpt-oss-120b` (Primary Ask candidate).
  - `openai/gpt-oss-20b` (Evaluation comparator).
- **Documented Free Tier Limits:** 30 RPM, 1,000 RPD, 8,000 TPM, 200,000 TPD.
- **Enforced OHMI Ceilings (≤80% Free Cap):**
  - RPM: 24
  - RPD: 800
  - TPM: 6,400
  - TPD: 160,000
- **Reasoning Controls:** `reasoning_effort: 'low'`, `include_reasoning: false`.
- **Live Account Status:** Offline mocking active; live account quota/readiness pending owner confirmation before activation.

### Google Gemini (Multimodal & Grounded Analysis)
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`.
- **Authentication:** `x-goog-api-key: $GEMINI_API_KEY` header.
- **Model Target:** `gemini-3.8-flash`.
- **Configuration Contract:**
  - Obsolete parameters removed (`temperature`, `topP`, `topK`, candidate counts, prefilled suffixes).
  - Low-thinking profile: `thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false }`.
  - Max tokens: 1,536 for V1 chat/PDF/image; 2,048 for tutorial; bounded for V2 circuit check.
- **Live Account Status:** Offline mocking active; live AI Studio quota confirmation required before activation.

### Qwen Retirement
- **Status:** Retired. All active imports, transports, environment variables, and fallback hooks removed.
- **Historical Data:** Stored database records referencing Qwen remain preserved for audit and replay compatibility.

## 3. Strict Safety & No-Charge Safeguards
1. **Zero Cross-Provider Fallback:** Provider outage returns honest 503 / 429 error; never attempts a fallback to a paid or alternate provider.
2. **Atomic In-Database Admission:** All attempts checked against advisory lock, concurrent lease (1 max pending), and per-user/per-project limits.
3. **No Client Exposure:** All provider API keys and service-role keys remain strictly within Supabase Edge secrets.

## 4. Implementation Completion & Release Manifest (M0 - M7)

### Verification Summary
- **Extension Vitest Suite:** 284/284 passed (including groq.test.ts, provider-policy.test.ts, handler.test.ts, gemini.test.ts, phase5-database.test.ts, i-provider-evaluation.test.ts).
- **Extension TypeScript Typecheck:** Clean (0 errors).
- **Extension Production Build:** Clean (Chrome MV3 manifest, 2.75 MB total size).
- **Web-App Node Test Suite:** 39/39 passed (including ackend.test.mjs, media.test.mjs, core.test.mjs, playground missions/engine).
- **Web-App TypeScript Typecheck:** Clean (0 errors).
- **Web-App Production Build:** Clean (Next.js 16.4.3 production build succeeded, all 32 static/dynamic routes).

### Database Migration
- Additive migration file: supabase/migrations/20261025050000_ohmi_ai_provider_routing.sql.
- Table public.ohmi_ai_provider_limits created with RLS enabled and service_role only access.
- Updated ohmi_reserve_ai:
  - Replay checks first.
  - Rejects retired Qwen on fresh reservations.
  - Enforces per-model RPM/RPD limits.
  - Enforces provider cooldowns.
- Updated ohmi_complete_ai:
  - Enforces approved models (openai/gpt-oss-120b, openai/gpt-oss-20b, gemini-3.8-flash, and historical models).
  - Records explicit provider provenance (groq for GroqCloud, gemini for Google Gemini).
- Updated ohmi_fail_ai and ohmi_defer_ai_provider.

### Staged Deployment & Cutover Sequence
1. **Database Migration Deployment:**
   - Apply 20261025050000_ohmi_ai_provider_routing.sql via Supabase migration runner.
   - Verifies ohmi_ai_provider_limits table and updated RPC functions.
2. **Secrets Provisioning:**
   - Set GROQ_API_KEY in Supabase Secrets.
   - Set GEMINI_API_KEY in Supabase Secrets.
   - Confirm OHMI_AI_ENABLED=true, OHMI_GROQ_CHAT_ENABLED=true, OHMI_GEMINI_MULTIMODAL_ENABLED=true.
3. **Edge Functions Deployment:**
   - Deploy ohmi-ai Edge Function.
   - Deploy ohmi-web Edge Function.
4. **Client Applications Deployment:**
   - Web App (PWA) deployment to hosting.
   - Extension package build for Chrome Web Store.

### Rollback Triggers & Procedures
- **Trigger 1 (GroqCloud Chat Failure / High Error Rate):**
  - Set OHMI_GROQ_CHAT_ENABLED=false in Supabase Secrets / Environment.
  - Result: Ask OHMI returns honest 503 "Conversational Ask OHMI is paused"; multimodal PDF, image, and circuit check remain fully functional.
- **Trigger 2 (Gemini Multimodal Failure / Upstream Safety Refusals):**
  - Set OHMI_GEMINI_MULTIMODAL_ENABLED=false in Supabase Secrets / Environment.
  - Result: Multimodal features pause; Groq chat remains fully functional.
- **Trigger 3 (Global Emergency):**
  - Set OHMI_AI_ENABLED=false in Supabase Secrets.
  - Result: Immediate global kill switch across all entry points. Saved user history and private projects remain intact.
- **Trigger 4 (Database Rollback):**
  - Schema is strictly additive. Backward-compatibility rows for legacy models (gemini-3.5-flash-lite, gemini-3.6-flash, qwen/qwen3.8-27b) are preserved in constraints and tables. Prior Edge Function code can run without database downgrade.