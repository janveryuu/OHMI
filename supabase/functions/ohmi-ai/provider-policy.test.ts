import { describe, it, expect } from 'vitest';
import {
  resolveAiRoute,
  checkRouteReadiness,
  sanitizeErrorMessage,
  GEMINI_PRODUCTION_MODEL,
  DEFAULT_GROQ_CHAT_MODEL
} from './provider-policy.ts';

describe('Provider Policy and Route Resolver (provider-policy.ts)', () => {
  describe('resolveAiRoute', () => {
    it('routes PDF operations to Gemini with gemini-3.5-flash-lite', () => {
      const route = resolveAiRoute('pdf');
      expect(route).toEqual({
        provider: 'gemini',
        model: GEMINI_PRODUCTION_MODEL,
        workflow: 'pdf'
      });
    });

    it('routes Image operations to Gemini with gemini-3.5-flash-lite', () => {
      const route = resolveAiRoute('image');
      expect(route).toEqual({
        provider: 'gemini',
        model: GEMINI_PRODUCTION_MODEL,
        workflow: 'image'
      });
    });

    it('routes Tutorial operations to Gemini with gemini-3.5-flash-lite', () => {
      const route = resolveAiRoute('tutorial');
      expect(route).toEqual({
        provider: 'gemini',
        model: GEMINI_PRODUCTION_MODEL,
        workflow: 'tutorial'
      });
    });

    it('routes Circuit Check V2 operations to Gemini with gemini-3.5-flash-lite', () => {
      const route = resolveAiRoute('circuit_check');
      expect(route).toEqual({
        provider: 'gemini',
        model: GEMINI_PRODUCTION_MODEL,
        workflow: 'circuit_check'
      });
    });

    it('routes follow-up chat linked to circuitAnalysisId to Gemini', () => {
      const route = resolveAiRoute('chat', { circuitAnalysisId: '11111111-1111-1111-1111-111111111111' });
      expect(route).toEqual({
        provider: 'gemini',
        model: GEMINI_PRODUCTION_MODEL,
        workflow: 'analysis_followup'
      });
    });

    it('routes follow-up chat with artifact reference to Gemini', () => {
      const route = resolveAiRoute('chat', { hasArtifactReference: true });
      expect(route).toEqual({
        provider: 'gemini',
        model: GEMINI_PRODUCTION_MODEL,
        workflow: 'analysis_followup'
      });
    });

    it('routes standard conversational chat to Groq with default 120b model', () => {
      const route = resolveAiRoute('chat');
      expect(route).toEqual({
        provider: 'groq',
        model: DEFAULT_GROQ_CHAT_MODEL,
        workflow: 'chat'
      });
    });

    it('allows configured Groq candidate 20b model', () => {
      const route = resolveAiRoute('chat', {}, 'openai/gpt-oss-20b');
      expect(route).toEqual({
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        workflow: 'chat'
      });
    });

    it('falls back to default 120b model when unapproved candidate model is configured', () => {
      const route = resolveAiRoute('chat', {}, 'unapproved-groq-model');
      expect(route.model).toBe(DEFAULT_GROQ_CHAT_MODEL);
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('redacts explicit secret key', () => {
      const raw = 'Failed to connect: gsk_testsecretkey123456789 is invalid';
      const clean = sanitizeErrorMessage(raw, 'gsk_testsecretkey123456789');
      expect(clean).not.toContain('gsk_testsecretkey123456789');
      expect(clean).toContain('[REDACTED_KEY]');
    });

    it('redacts generic bearer tokens and signed URLs', () => {
      const raw = 'Auth Bearer eyJhbGciOiJIUzI1NiJ9 failed for https://bucket.supabase.co/v1/obj?token=secret123';
      const clean = sanitizeErrorMessage(raw);
      expect(clean).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(clean).not.toContain('secret123');
      expect(clean).toContain('Bearer [REDACTED]');
      expect(clean).toContain('[REDACTED_URL]');
    });
  });

  describe('checkRouteReadiness', () => {
    it('disables route when master switch OHMI_AI_ENABLED is not true', () => {
      const route = resolveAiRoute('chat');
      const readiness = checkRouteReadiness(route, {
        OHMI_AI_ENABLED: 'false',
        OHMI_GROQ_CHAT_ENABLED: 'true',
        GROQ_API_KEY: 'gsk_valid'
      });
      expect(readiness.enabled).toBe(false);
      expect(readiness.reason).toContain('OHMI_AI_ENABLED != true');
    });

    it('checks Groq route readiness independently', () => {
      const route = resolveAiRoute('chat');
      // Groq disabled
      expect(
        checkRouteReadiness(route, {
          OHMI_AI_ENABLED: 'true',
    GEMINI_FREE_TIER_CONFIRMED: 'true', GROQ_FREE_TIER_CONFIRMED: 'true',
          OHMI_GROQ_CHAT_ENABLED: 'false',
          GROQ_API_KEY: 'gsk_valid'
        }).enabled
      ).toBe(false);

      // Groq missing key
      expect(
        checkRouteReadiness(route, {
          OHMI_AI_ENABLED: 'true',
    GEMINI_FREE_TIER_CONFIRMED: 'true', GROQ_FREE_TIER_CONFIRMED: 'true',
          OHMI_GROQ_CHAT_ENABLED: 'true',
          GROQ_API_KEY: ''
        }).enabled
      ).toBe(false);

      // Groq ready
      expect(
        checkRouteReadiness(route, {
          OHMI_AI_ENABLED: 'true',
    GEMINI_FREE_TIER_CONFIRMED: 'true', GROQ_FREE_TIER_CONFIRMED: 'true',
          OHMI_GROQ_CHAT_ENABLED: 'true',
          GROQ_API_KEY: 'gsk_valid'
        }).enabled
      ).toBe(true);
    });

    it('checks Gemini route readiness independently', () => {
      const route = resolveAiRoute('pdf');
      // Gemini disabled
      expect(
        checkRouteReadiness(route, {
          OHMI_AI_ENABLED: 'true',
    GEMINI_FREE_TIER_CONFIRMED: 'true', GROQ_FREE_TIER_CONFIRMED: 'true',
          OHMI_GEMINI_MULTIMODAL_ENABLED: 'false',
          GEMINI_API_KEY: 'AIzaSyValid'
        }).enabled
      ).toBe(false);

      // Gemini missing key
      expect(
        checkRouteReadiness(route, {
          OHMI_AI_ENABLED: 'true',
    GEMINI_FREE_TIER_CONFIRMED: 'true', GROQ_FREE_TIER_CONFIRMED: 'true',
          OHMI_GEMINI_MULTIMODAL_ENABLED: 'true',
          GEMINI_API_KEY: ''
        }).enabled
      ).toBe(false);

      // Gemini ready
      expect(
        checkRouteReadiness(route, {
          OHMI_AI_ENABLED: 'true',
    GEMINI_FREE_TIER_CONFIRMED: 'true', GROQ_FREE_TIER_CONFIRMED: 'true',
          OHMI_GEMINI_MULTIMODAL_ENABLED: 'true',
          GEMINI_API_KEY: 'AIzaSyValid'
        }).enabled
      ).toBe(true);
    });

    it('disabling Gemini does not affect Groq chat readiness', () => {
      const groqRoute = resolveAiRoute('chat');
      const readiness = checkRouteReadiness(groqRoute, {
        OHMI_AI_ENABLED: 'true',
    GEMINI_FREE_TIER_CONFIRMED: 'true', GROQ_FREE_TIER_CONFIRMED: 'true',
        OHMI_GROQ_CHAT_ENABLED: 'true',
        GROQ_API_KEY: 'gsk_valid',
        OHMI_GEMINI_MULTIMODAL_ENABLED: 'false',
        GEMINI_API_KEY: ''
      });
      expect(readiness.enabled).toBe(true);
    });
  });
});
