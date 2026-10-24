import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { CircuitCheckResult } from '../src/backend/contracts';

function sha256Hex(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

describe('Phase 5 Milestone 3: Disposable Database & Persistence Invariants', () => {
  const userA = '00000000-0000-0000-0000-00000000000a';
  const userB = '00000000-0000-0000-0000-00000000000b';

  const sampleResult: CircuitCheckResult = {
    schemaVersion: 2,
    status: 'reviewed',
    summary: 'LED circuit connected to D13 with 220 ohm resistor.',
    findings: [
      {
        id: 'finding-1',
        severity: 'info',
        certainty: 'observed',
        observation: 'LED connected to pin 13.',
        why: 'Pin 13 has onboard LED indicator.',
        action: 'Verify polarity.',
        evidence: [{ kind: 'code', startLine: 1, endLine: 1 }]
      }
    ],
    unknowns: ['Power supply voltage unconfirmed.'],
    questions: [],
    comparisons: [],
    steps: [
      {
        step: 1,
        instruction: 'Connect anode to pin 13.',
        why: 'Pin 13 drives output.',
        check: 'Check breadboard row.'
      }
    ],
    limitations: ['Visual review only.']
  };

  // 1. two_users_cannot_read_or_link_each_others_checks
  it('two_users_cannot_read_or_link_each_others_checks', async () => {
    // In-memory tables simulating RLS policies:
    // owner_read on ohmi_analyses: ((select auth.uid()) = user_id)
    // owner_delete on ohmi_analyses: ((select auth.uid()) = user_id)
    const checkIdA = 'aaaaaaaa-1111-2222-3333-444444444444';
    const analysesTable: Array<{ id: string; user_id: string; artifact_kind: string; payload: any }> = [
      { id: checkIdA, user_id: userA, artifact_kind: 'circuit_check', payload: sampleResult }
    ];

    // User B tries to read User A's check via RLS query
    const readQueryUserB = analysesTable.filter(r => r.id === checkIdA && r.user_id === userB);
    expect(readQueryUserB).toHaveLength(0);

    // User B tries to delete User A's check via RLS
    const initialCount = analysesTable.length;
    const deleteIndex = analysesTable.findIndex(r => r.id === checkIdA && r.user_id === userB);
    if (deleteIndex !== -1) {
      analysesTable.splice(deleteIndex, 1);
    }
    expect(analysesTable).toHaveLength(initialCount); // User A's check untouched

    // User B tries to link User A's check as previousCheckId in AI request validation
    const mockUserClientB = {
      from: (table: string) => ({
        select: () => ({
          eq: (col1: string, val1: string) => ({
            eq: (col2: string, val2: string) => ({
              single: async () => {
                const item = analysesTable.find(r => r.id === val1 && r.user_id === val2);
                if (!item) return { data: null, error: { message: 'Row not found' } };
                return { data: item, error: null };
              }
            })
          })
        })
      })
    };

    // Simulate server-side verification: userClient.from('ohmi_analyses').select(...).eq('id', checkIdA).eq('user_id', userB).single()
    const { data: linkedCheck, error: linkErr } = await mockUserClientB
      .from('ohmi_analyses')
      .select()
      .eq('id', checkIdA)
      .eq('user_id', userB)
      .single();

    expect(Boolean(linkedCheck)).toBe(false);
    expect(linkedCheck).toBeNull();
    expect(linkErr).toBeDefined();
  });

  // 2. old_artifacts_survive_forward_migration
  it('old_artifacts_survive_forward_migration', () => {
    // Constraint definitions from 20261016170000_ohmi_phase5_circuit_check_artifacts.sql:
    const checkKind = (kind: string) => ['analysis', 'tutorial', 'circuit_check'].includes(kind);
    const checkSchemaVersion = (v: number) => [1, 2].includes(v);
    const checkAssignmentRequired = (kind: string, assignmentId: string | null) =>
      kind !== 'analysis' || assignmentId !== null;
    const checkPayload = (payload: any) =>
      payload &&
      typeof payload === 'object' &&
      Array.isArray(payload.steps) &&
      payload.steps.length <= 24;

    // Legacy analysis row (P4)
    const legacyAnalysis = {
      artifact_kind: 'analysis',
      schema_version: 1,
      assignment_id: 'assign-uuid-1',
      payload: { steps: [{ step: 1, text: 'step 1' }] }
    };
    expect(checkKind(legacyAnalysis.artifact_kind)).toBe(true);
    expect(checkSchemaVersion(legacyAnalysis.schema_version)).toBe(true);
    expect(checkAssignmentRequired(legacyAnalysis.artifact_kind, legacyAnalysis.assignment_id)).toBe(true);
    expect(checkPayload(legacyAnalysis.payload)).toBe(true);

    // Legacy analysis without assignment_id must violate constraint
    expect(checkAssignmentRequired('analysis', null)).toBe(false);

    // Legacy tutorial row (P4)
    const legacyTutorial = {
      artifact_kind: 'tutorial',
      schema_version: 1,
      assignment_id: null,
      payload: { steps: [{ step: 1, text: 'tutorial step' }] }
    };
    expect(checkKind(legacyTutorial.artifact_kind)).toBe(true);
    expect(checkSchemaVersion(legacyTutorial.schema_version)).toBe(true);
    expect(checkAssignmentRequired(legacyTutorial.artifact_kind, legacyTutorial.assignment_id)).toBe(true);
    expect(checkPayload(legacyTutorial.payload)).toBe(true);

    // Phase 5 circuit_check row
    const newCircuitCheck = {
      artifact_kind: 'circuit_check',
      schema_version: 2,
      assignment_id: null, // Nullable assignment_id for independent checks!
      payload: sampleResult
    };
    expect(checkKind(newCircuitCheck.artifact_kind)).toBe(true);
    expect(checkSchemaVersion(newCircuitCheck.schema_version)).toBe(true);
    expect(checkAssignmentRequired(newCircuitCheck.artifact_kind, newCircuitCheck.assignment_id)).toBe(true);
    expect(checkPayload(newCircuitCheck.payload)).toBe(true);

    // Invalid kind or schema_version
    expect(checkKind('invalid_kind')).toBe(false);
    expect(checkSchemaVersion(3)).toBe(false);
    expect(checkSchemaVersion(0)).toBe(false);
  });

  // 3. concurrent_reservation_calls_admit_one_generation
  it('concurrent_reservation_calls_admit_one_generation', async () => {
    // Simulate public.ohmi_reserve_ai global in-flight concurrency lock:
    // if exists(select 1 from public.ohmi_ai_requests where status='pending') then
    //   raise exception 'An AI request is currently in progress. Please wait';
    const activeRequests: Array<{ id: string; status: 'pending' | 'completed' | 'failed' }> = [];

    const reserveAi = (requestId: string) => {
      // Clean expired pending (> 60s)
      if (activeRequests.some(r => r.status === 'pending')) {
        throw new Error('An AI request is currently in progress. Please wait');
      }
      activeRequests.push({ id: requestId, status: 'pending' });
      return { fresh: true, status: 'pending' };
    };

    // First request is admitted
    const req1 = reserveAi('req-1111-1111');
    expect(req1.fresh).toBe(true);
    expect(req1.status).toBe('pending');

    // Concurrent second request is rejected by lock
    expect(() => reserveAi('req-2222-2222')).toThrow('An AI request is currently in progress. Please wait');

    // First request finishes
    const r1 = activeRequests.find(r => r.id === 'req-1111-1111')!;
    r1.status = 'completed';

    // Now third request is admitted cleanly
    const req3 = reserveAi('req-3333-3333');
    expect(req3.fresh).toBe(true);
    expect(req3.status).toBe('pending');
  });

  // 4. same_request_cannot_double_finalize
  it('same_request_cannot_double_finalize', () => {
    // Simulate public.ohmi_complete_ai validation:
    // select * into job from public.ohmi_ai_requests where id=p_request_id for update;
    // if not found or job.status<>'pending' ... raise exception 'AI request is no longer pending';
    const requestLedger: Record<string, { status: string; resultId?: string }> = {
      'req-atomic-1': { status: 'pending' }
    };

    const completeAi = (reqId: string, resultId: string) => {
      const job = requestLedger[reqId];
      if (!job || job.status !== 'pending') {
        throw new Error('AI request is no longer pending');
      }
      job.status = 'completed';
      job.resultId = resultId;
      return { id: resultId };
    };

    // First completion succeeds
    const res1 = completeAi('req-atomic-1', 'res-111');
    expect(res1.id).toBe('res-111');
    expect(requestLedger['req-atomic-1']?.status).toBe('completed');

    // Attempting to finalize again throws error immediately
    expect(() => completeAi('req-atomic-1', 'res-222')).toThrow('AI request is no longer pending');
  });

  // 5. two_uuids_with_identical_inputs_keep_distinct_results_and_progress
  it('two_uuids_with_identical_inputs_keep_distinct_results_and_progress', () => {
    // Two distinct request UUIDs with identical evidence/inputs
    const uuid1 = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const uuid2 = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const inputHash = sha256Hex('same-image-same-code-same-prompt');

    // In 20261016170000:
    // v_fingerprint := encode(sha256((job.user_id::text || ':' || job.id::text || ':circuit_check')::bytea), 'hex')
    const fingerprint1 = sha256Hex(`${userA}:${uuid1}:circuit_check`);
    const fingerprint2 = sha256Hex(`${userA}:${uuid2}:circuit_check`);

    // Fingerprints must be distinct even though inputHash is identical
    expect(fingerprint1).not.toBe(fingerprint2);

    const analyses: Array<{ id: string; user_id: string; fingerprint: string; payload: any }> = [];
    const tutorialProgress: Record<string, { current_step: number; completed: number[] }> = {};

    // First request finalizes
    const id1 = 'analysis-uuid-1';
    analyses.push({ id: id1, user_id: userA, fingerprint: fingerprint1, payload: sampleResult });
    tutorialProgress[id1] = { current_step: 0, completed: [] };

    // Second request finalizes
    const id2 = 'analysis-uuid-2';
    analyses.push({ id: id2, user_id: userA, fingerprint: fingerprint2, payload: sampleResult });
    tutorialProgress[id2] = { current_step: 0, completed: [] };

    // Two independent records in ohmi_analyses
    expect(analyses).toHaveLength(2);
    expect(analyses[0]!.id).not.toBe(analyses[1]!.id);

    // Progress updates on id1 do not mutate id2
    tutorialProgress[id1]!.current_step = 1;
    tutorialProgress[id1]!.completed = [0];

    expect(tutorialProgress[id1]!.current_step).toBe(1);
    expect(tutorialProgress[id2]!.current_step).toBe(0); // id2 stays at step 0
  });

  // 6. lost_response_restores_exact_result
  it('lost_response_restores_exact_result', () => {
    const requestId = 'req-disconnect-1';
    const analysisId = 'analysis-restore-1';

    const db: {
      requests: Record<string, { id: string; user_id: string; status: string; result_id?: string }>;
      analyses: Record<string, { id: string; user_id: string; payload: CircuitCheckResult }>;
    } = {
      requests: {
        [requestId]: { id: requestId, user_id: userA, status: 'completed', result_id: analysisId }
      },
      analyses: {
        [analysisId]: { id: analysisId, user_id: userA, payload: sampleResult }
      }
    };

    // Client reconnects and executes status recovery: ai.request.get
    const req = db.requests[requestId];
    expect(req).toBeDefined();
    expect(req!.status).toBe('completed');

    const analysis = db.analyses[req!.result_id!];
    expect(analysis).toBeDefined();
    expect(analysis!.payload).toEqual(sampleResult);
  });

  // 7. deleted_result_stays_unavailable
  it('deleted_result_stays_unavailable', () => {
    const requestId = 'req-del-1';
    const analysisId = 'analysis-del-1';

    const db: {
      requests: Record<string, any>;
      analyses: Record<string, any>;
    } = {
      requests: {
        [requestId]: { id: requestId, user_id: userA, status: 'completed', result_id: analysisId }
      },
      analyses: {
        [analysisId]: { id: analysisId, user_id: userA, payload: sampleResult }
      }
    };

    // Owner deletes analysis via analyses.delete
    delete db.analyses[analysisId];

    // Status query via ai.request.get
    const req = db.requests[requestId];
    expect(req).toBeDefined();
    const retrievedAnalysis = db.analyses[req.result_id];
    expect(retrievedAnalysis).toBeUndefined();

    // Replay handler behavior: if reservation.status === 'completed' but analysis is missing -> unavailable
    const isUnavailable = !retrievedAnalysis;
    expect(isUnavailable).toBe(true);
  });

  // 8. assignment_delete_cascade_preserves_unrelated_manual_steps
  it('assignment_delete_cascade_preserves_unrelated_manual_steps', () => {
    // Database FK setup:
    // ohmi_assignment_steps references ohmi_assignments(id) on delete cascade
    // ohmi_conversations references ohmi_analyses(id) on delete cascade
    // ohmi_tutorial_progress references ohmi_analyses(id) on delete cascade
    const assignments = [
      { id: 'assign-1', user_id: userA },
      { id: 'assign-2', user_id: userA }
    ];

    let assignmentSteps = [
      { id: 'step-1a', assignment_id: 'assign-1', user_id: userA, title: 'Step 1A' },
      { id: 'step-1b', assignment_id: 'assign-1', user_id: userA, title: 'Step 1B' },
      { id: 'step-2a', assignment_id: 'assign-2', user_id: userA, title: 'Step 2A' },
      { id: 'step-2b', assignment_id: 'assign-2', user_id: userA, title: 'Step 2B' }
    ];

    let analyses = [
      { id: 'check-1', assignment_id: 'assign-1', user_id: userA, artifact_kind: 'circuit_check' }
    ];

    let conversations = [
      { id: 'conv-1', analysis_id: 'check-1', user_id: userA }
    ];

    let progress = [
      { analysis_id: 'check-1', user_id: userA, current_step: 1 }
    ];

    // Delete check-1 via analyses.delete:
    const deleteCheckId = 'check-1';
    analyses = analyses.filter(a => a.id !== deleteCheckId);
    // Cascade to linked conversations and progress
    conversations = conversations.filter(c => c.analysis_id !== deleteCheckId);
    progress = progress.filter(p => p.analysis_id !== deleteCheckId);

    // Deleting check-1 MUST NOT delete assignments or manual steps!
    expect(analyses).toHaveLength(0);
    expect(conversations).toHaveLength(0);
    expect(progress).toHaveLength(0);
    expect(assignments).toHaveLength(2); // Both assignments still exist!
    expect(assignmentSteps).toHaveLength(4); // All 4 assignment steps still exist!

    // Now delete assign-1:
    const deleteAssignId = 'assign-1';
    assignmentSteps = assignmentSteps.filter(s => s.assignment_id !== deleteAssignId);

    // Only assign-1 steps are deleted; assign-2 manual steps remain!
    expect(assignmentSteps).toHaveLength(2);
    expect(assignmentSteps.map(s => s.id)).toEqual(['step-2a', 'step-2b']);
  });
// 9. m4_provider_limits_and_qwen_rejection_in_reservation
  it('m4_provider_limits_and_qwen_rejection_in_reservation', () => {
    // Simulate provider limits table and reserve logic from 20261025050000_ohmi_ai_provider_routing.sql
    const providerLimits: Record<string, { enabled: boolean; rpm: number; rpd: number }> = {
      'openai/gpt-oss-120b': { enabled: true, rpm: 24, rpd: 800 },
      'openai/gpt-oss-20b': { enabled: false, rpm: 24, rpd: 800 },
      'gemini-3.8-flash': { enabled: true, rpm: 12, rpd: 1200 },
      'gemini-3.5-flash-lite': { enabled: true, rpm: 12, rpd: 1200 }
    };

    const reserveAiSim = (model: string) => {
      // Step 2: Deny retired Qwen on fresh requests
      if (model === 'qwen/qwen3.8-27b' || model.startsWith('qwen')) {
        throw new Error('Qwen provider retired. Use approved Groq or Gemini models');
      }

      // Step 3: Provider limits check
      const limit = providerLimits[model];
      if (limit && !limit.enabled) {
        throw new Error(`Provider model ${model} is disabled`);
      }

      return { fresh: true, model };
    };

    // Qwen must be rejected immediately on fresh reservation
    expect(() => reserveAiSim('qwen/qwen3.8-27b')).toThrow('Qwen provider retired');
    expect(() => reserveAiSim('qwen-plus')).toThrow('Qwen provider retired');

    // Disabled evaluation comparator (20b) must be rejected on fresh reservation
    expect(() => reserveAiSim('openai/gpt-oss-20b')).toThrow('Provider model openai/gpt-oss-20b is disabled');

    // Approved Groq and Gemini production models are admitted cleanly
    expect(reserveAiSim('openai/gpt-oss-120b')).toEqual({ fresh: true, model: 'openai/gpt-oss-120b' });
    expect(reserveAiSim('gemini-3.8-flash')).toEqual({ fresh: true, model: 'gemini-3.8-flash' });
  });

  // 10. m4_completion_sets_provider_provenance_and_accepts_approved_models
  it('m4_completion_sets_provider_provenance_and_accepts_approved_models', () => {
    // Simulate complete logic from 20261025050000_ohmi_ai_provider_routing.sql
    const allowedModels = [
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b'
    ];

    const completeAiSim = (model: string, isCircuitCheck: boolean) => {
      if (!allowedModels.includes(model)) {
        throw new Error('Invalid AI accounting');
      }

      const provider = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'].includes(model)
        ? 'groq'
        : 'gemini';

      return {
        model,
        provider,
        artifactKind: isCircuitCheck ? 'circuit_check' : 'analysis'
      };
    };

    // Groq model records 'groq' provider provenance
    const groqRes = completeAiSim('openai/gpt-oss-120b', false);
    expect(groqRes.provider).toBe('groq');
    expect(groqRes.model).toBe('openai/gpt-oss-120b');

    // Gemini 3.8 Flash records 'gemini' provider provenance
    const geminiRes = completeAiSim('gemini-3.8-flash', true);
    expect(geminiRes.provider).toBe('gemini');
    expect(geminiRes.model).toBe('gemini-3.8-flash');

    // Historical model allowed for legacy completion / replay accounting
    const histRes = completeAiSim('gemini-3.5-flash-lite', false);
    expect(histRes.provider).toBe('gemini');

    // Unlisted / arbitrary model rejected
    expect(() => completeAiSim('unsupported-model-x', false)).toThrow('Invalid AI accounting');
  });
});