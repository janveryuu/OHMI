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
