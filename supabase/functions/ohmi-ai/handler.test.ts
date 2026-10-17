import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAiRequest } from './handler.ts';
import { verifyPageCitation } from './pdf.ts';

describe('Production Edge AI Handler Tests & Regressions', () => {
  const defaultEnv = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    GEMINI_API_KEY: 'test-gemini-key',
    OHMI_AI_ENABLED: 'true'
  };

  let mockUser: any;
  let mockRpc: any;
  let mockStorage: any;
  let mockFrom: any;
  let mockFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUser = { id: '00000000-0000-0000-0000-000000000001', email: 'student@example.test' };

    mockRpc = vi.fn().mockImplementation((fn: string, args: any) => {
      if (fn === 'ohmi_reserve_ai') {
        return Promise.resolve({ data: { fresh: true, status: 'pending' }, error: null });
      }
      if (fn === 'ohmi_complete_ai') {
        return Promise.resolve({ data: { id: '11111111-1111-1111-1111-111111111111' }, error: null });
      }
      if (fn === 'ohmi_fail_ai' || fn === 'ohmi_defer_ai_provider') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockStorage = {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue({
          data: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]),
          error: null
        })
      })
    };

    mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: '22222222-2222-2222-2222-222222222222',
          user_id: '00000000-0000-0000-0000-000000000001',
          original_name: 'test.png',
          object_path: '00000000-0000-0000-0000-000000000001/test.png',
          mime_type: 'image/png',
          size_bytes: 100,
          status: 'ready'
        },
        error: null
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    });

    mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: 'Here is the circuit advice.' }] }
            }
          ],
          usageMetadata: {
            promptTokenCount: 120,
            candidatesTokenCount: 45
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  });

  const createMockClientFactory = () => {
    return (url: string, key: string, opts?: any) => {
      const isAnon = key === defaultEnv.SUPABASE_ANON_KEY;
      return {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null })
        },
        rpc: mockRpc,
        storage: mockStorage,
        from: mockFrom
      };
    };
  };

  const createRequest = (body: any, headers: Record<string, string> = {}) => {
    return new Request('https://test.supabase.co/functions/v1/ohmi-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-jwt-token',
        ...headers
      },
      body: JSON.stringify(body)
    });
  };

  it('regression 1: completion_rpc_error_is_not_saved_success', async () => {
    // When ohmi_complete_ai returns an error, handler must NOT return 200/saved success!
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'ohmi_reserve_ai') {
        return Promise.resolve({ data: { fresh: true, status: 'pending' }, error: null });
      }
      if (fn === 'ohmi_complete_ai') {
        return Promise.resolve({ data: null, error: { message: 'Database constraint violation' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = createRequest({
      version: 1,
      requestId: '33333333-3333-3333-3333-333333333333',
      operation: 'chat',
      language: 'english',
      message: 'Explain Ohm law'
    });

    const res = await handleAiRequest(req, {
      env: defaultEnv,
      createClient: createMockClientFactory(),
      fetch: mockFetch
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.code).toBe('server_error');
    expect(data.error).toContain('Failed to save');
  });

  it('regression 2: replay_restores_exact_structured_result_during_cooldown', async () => {
    // Replay of existing completed request during provider cooldown must return exact saved result
    const savedResult = {
      status: 'answer',
      answer: 'Previously completed analysis of circuit.',
      steps: [{ step: 1, instruction: 'Add wire', why: 'Connect', check: 'Done' }]
    };

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'ohmi_reserve_ai') {
        // Returns completed reservation (replay)
        return Promise.resolve({
          data: {
            fresh: false,
            status: 'completed',
            conversation_id: '44444444-4444-4444-4444-444444444444',
            model: 'gemini-3.5-flash-lite'
          },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { structured_result: savedResult, content: 'Fallback content' },
        error: null
      })
    });

    const req = createRequest({
      version: 1,
      requestId: '33333333-3333-3333-3333-333333333333',
      operation: 'chat',
      language: 'english',
      message: 'Explain Ohm law',
      conversationId: '44444444-4444-4444-4444-444444444444'
    });

    const res = await handleAiRequest(req, {
      env: defaultEnv,
      createClient: createMockClientFactory(),
      fetch: mockFetch
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.result).toEqual(savedResult);
    // Fetch should NOT have been called for Gemini generation!
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('regression 3: same_uuid_different_conversation_conflicts', async () => {
    // When same requestId is reused with different conversation / parameters, RPC rejects with replay mismatch
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'ohmi_reserve_ai') {
        return Promise.resolve({ data: null, error: { message: 'Request replay does not match' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = createRequest({
      version: 1,
      requestId: '33333333-3333-3333-3333-333333333333',
      operation: 'chat',
      language: 'english',
      message: 'Explain Ohm law',
      conversationId: '55555555-5555-5555-5555-555555555555'
    });

    const res = await handleAiRequest(req, {
      env: defaultEnv,
      createClient: createMockClientFactory(),
      fetch: mockFetch
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.code).toBe('conflict');
  });

  it('regression 4: non_stop_and_invalid_tutorial_are_rejected', async () => {
    // A: finishReason !== 'STOP' (e.g. MAX_TOKENS / truncated)
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'MAX_TOKENS',
              content: { parts: [{ text: 'Incomplete truncated text...' }] }
            }
          ],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 2048 }
        }),
        { status: 200 }
      )
    );

    const req1 = createRequest({
      version: 1,
      requestId: '33333333-3333-3333-3333-333333333333',
      operation: 'chat',
      language: 'english',
      message: 'Write a long tutorial'
    });

    const res1 = await handleAiRequest(req1, {
      env: defaultEnv,
      createClient: createMockClientFactory(),
      fetch: mockFetch
    });

    expect(res1.status).toBe(502);
    const data1 = await res1.json();
    expect(data1.ok).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith('ohmi_fail_ai', expect.objectContaining({ p_error_code: 'truncated' }));

    // B: Invalid tutorial result (malformed / missing required fields) must be rejected, not fabricated
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: 'Here is your tutorial: { "status": "tutorial", "steps": [] }' }] }
            }
          ],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 }
        }),
        { status: 200 }
      )
    );

    const req2 = createRequest({
      version: 1,
      requestId: '66666666-6666-6666-6666-666666666666',
      operation: 'tutorial',
      language: 'english',
      message: 'Build a circuit'
    });

    const res2 = await handleAiRequest(req2, {
      env: defaultEnv,
      createClient: createMockClientFactory(),
      fetch: mockFetch
    });

    expect(res2.status).toBe(502);
    const data2 = await res2.json();
    expect(data2.ok).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith('ohmi_fail_ai', expect.objectContaining({ p_error_code: 'invalid_tutorial' }));
  });

  it('regression 5: pdf_requirement_excerpt_must_match_claimed_page', () => {
    // Tests verifyPageCitation against actual extracted page texts
    const pages = [
      'Welcome to Lab 1. In this assignment, students will construct an LED circuit using a 220 ohm resistor.',
      'Connect the LED anode to pin 9 and cathode to GND through the resistor. Run the simulation to verify.'
    ];

    // Page 1 contains 220 ohm resistor
    const matchP1 = verifyPageCitation(pages, 1, '220 ohm resistor');
    expect(matchP1.verified).toBe(true);

    // Page 1 does NOT contain 'pin 9' (it is on page 2)
    const mismatch = verifyPageCitation(pages, 1, 'pin 9');
    expect(mismatch.verified).toBe(false);
    expect(mismatch.details).toContain('not found on page 1');

    // Page out of bounds
    const outOfBounds = verifyPageCitation(pages, 5, 'resistor');
    expect(outOfBounds.verified).toBe(false);
    expect(outOfBounds.details).toContain('out of bounds');
  });

  it('regression 6: unknown_usage_is_not_zero', async () => {
    // When usageMetadata is omitted by provider, handler must use conservative estimate (not 0)
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: 'Here is an answer without usage metadata.' }] }
            }
          ]
          // usageMetadata is omitted!
        }),
        { status: 200 }
      )
    );

    const req = createRequest({
      version: 1,
      requestId: '77777777-7777-7777-7777-777777777777',
      operation: 'chat',
      language: 'english',
      message: 'Test usage'
    });

    const res = await handleAiRequest(req, {
      env: defaultEnv,
      createClient: createMockClientFactory(),
      fetch: mockFetch
    });

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'ohmi_complete_ai',
      expect.objectContaining({
        p_input_tokens: expect.any(Number),
        p_output_tokens: expect.any(Number)
      })
    );

    const completeCall = mockRpc.mock.calls.find((c: any[]) => c[0] === 'ohmi_complete_ai');
    expect(completeCall[1].p_input_tokens).toBeGreaterThan(0);
    expect(completeCall[1].p_output_tokens).toBeGreaterThan(0);
  });

  it('enforces kill switch when OHMI_AI_ENABLED is not true', async () => {
    const req = createRequest({
      version: 1,
      requestId: '88888888-8888-8888-8888-888888888888',
      operation: 'chat',
      language: 'english',
      message: 'Test kill switch'
    });

    const res = await handleAiRequest(req, {
      env: { ...defaultEnv, OHMI_AI_ENABLED: 'false' },
      createClient: createMockClientFactory(),
      fetch: mockFetch
    });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.code).toBe('unavailable');
    expect(data.error).toContain('kill switch');
  });

  it('enforces operation-to-source MIME matching', async () => {
    // Attempting operation 'image' on a PDF assignment file must fail with 400
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: '99999999-9999-9999-9999-999999999999',
          user_id: '00000000-0000-0000-0000-000000000001',
          original_name: 'assignment.pdf',
          mime_type: 'application/pdf',
          size_bytes: 500,
          status: 'ready'
        },
        error: null
      })
    });

    const req = createRequest({
      version: 1,
      requestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      operation: 'image', // Mismatched! Expected image, assignment is PDF
      assignmentId: '99999999-9999-9999-9999-999999999999',
      language: 'english',
      message: 'Analyze circuit'
    });

    const res = await handleAiRequest(req, {
      env: defaultEnv,
      createClient: createMockClientFactory(),
      fetch: mockFetch
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('not an image');
  });

  describe('Phase 5 Milestone 2: Version 2 AI Circuit Checker Handler', () => {
    const validV2Body = {
      version: 2,
      operation: 'circuit_check',
      requestId: '11111111-2222-3333-4444-555555555555',
      language: 'english',
      mode: 'check',
      message: 'Does this LED circuit work?',
      board: 'uno-r3',
      images: [],
      code: 'void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); }'
    };

    const mockV2CircuitResult = {
      schemaVersion: 2,
      status: 'reviewed',
      summary: 'LED circuit connected correctly to pin 13.',
      findings: [
        {
          id: 'finding-1',
          severity: 'info',
          certainty: 'observed',
          observation: 'Pin 13 is set as OUTPUT and driven HIGH.',
          why: 'This provides supply voltage to the LED.',
          action: 'Ensure a current-limiting resistor is placed in series.',
          evidence: [{ kind: 'code', startLine: 1, endLine: 2 }]
        }
      ],
      unknowns: ['Physical breadboard wiring is unobserved.'],
      questions: [],
      comparisons: [],
      steps: [
        {
          step: 1,
          instruction: 'Place a 220Ω resistor between pin 13 and LED anode.',
          why: 'To limit forward current through the LED.',
          check: 'Verify resistor color code: Red-Red-Brown-Gold.',
          findingId: 'finding-1'
        }
      ],
      limitations: ['Code-only analysis; physical connections are not inspected.']
    };

    it('rejects bodies exceeding 6 MiB with 413', async () => {
      const hugeData = 'a'.repeat(6 * 1024 * 1024 + 10);
      const req = new Request('https://test.supabase.co/functions/v1/ohmi-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
          'Content-Length': String(hugeData.length)
        },
        body: hugeData
      });

      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.code).toBe('payload_too_large');
      expect(data.error).toContain('6 MiB');
    });

    it('rejects version 1 body exceeding 32 KiB with 413', async () => {
      const v1Oversized = {
        version: 1,
        requestId: '11111111-2222-3333-4444-555555555555',
        operation: 'chat',
        language: 'english',
        message: 'x'.repeat(33 * 1024)
      };
      const req = createRequest(v1Oversized);

      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.code).toBe('payload_too_large');
      expect(data.error).toContain('32 KiB');
    });

    it('rejects unsupported contract versions with 400', async () => {
      const req = createRequest({ version: 99, requestId: '11111111-2222-3333-4444-555555555555' });
      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe('invalid_request');
      expect(data.error).toContain('Unsupported contract version');
    });

    it('rejects version 2 request missing both image and code with 400', async () => {
      const invalidReq = {
        ...validV2Body,
        code: undefined,
        images: []
      };
      const req = createRequest(invalidReq);

      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe('invalid_request');
      expect(data.error).toContain('requires visual evidence');
    });

    it('rejects follow_up mode with images or missing previousCheckId with 400', async () => {
      const followUpWithImages = {
        ...validV2Body,
        mode: 'follow_up',
        images: [{ id: 'overview', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }]
      };
      const res1 = await handleAiRequest(createRequest(followUpWithImages), {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });
      expect(res1.status).toBe(400);

      const followUpNoPrior = {
        ...validV2Body,
        mode: 'follow_up',
        images: []
      };
      const res2 = await handleAiRequest(createRequest(followUpNoPrior), {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });
      expect(res2.status).toBe(400);
      const data2 = await res2.json();
      expect(data2.error).toContain('previousCheckId');
    });

    it('rejects foreign or unowned assignmentId with 404', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
      });

      const req = createRequest({
        ...validV2Body,
        assignmentId: '99999999-9999-9999-9999-999999999999',
        assignmentAnalysisId: '88888888-8888-8888-8888-888888888888'
      });

      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.code).toBe('not_found');
      expect(data.error).toContain('Assignment not found');
    });

    it('successfully processes V2 circuit check and finalizes result atomically', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: JSON.stringify(mockV2CircuitResult) }] }
              }
            ],
            usageMetadata: {
              promptTokenCount: 350,
              candidatesTokenCount: 220
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createRequest(validV2Body);
      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.operation).toBe('circuit_check');
      expect(data.result.schemaVersion).toBe(2);
      expect(data.result.status).toBe('reviewed');
      expect(data.result.findings).toHaveLength(1);

      expect(mockRpc).toHaveBeenCalledWith('ohmi_reserve_ai', expect.objectContaining({
        p_kind: 'circuit_check',
        p_request_id: validV2Body.requestId
      }));

      expect(mockRpc).toHaveBeenCalledWith('ohmi_complete_ai', expect.objectContaining({
        p_request_id: validV2Body.requestId,
        p_input_tokens: 350,
        p_output_tokens: 220,
        p_output: expect.objectContaining({
          schemaVersion: 2,
          status: 'reviewed'
        })
      }));
    });

    it('replays exact structured V2 result during cooldown without provider call', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'ohmi_reserve_ai') {
          return Promise.resolve({
            data: { fresh: false, status: 'completed', result_id: 'res-1' },
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { payload: mockV2CircuitResult },
          error: null
        })
      });

      const req = createRequest(validV2Body);
      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result).toEqual(mockV2CircuitResult);
      // Zero provider generation calls!
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects non-STOP finishReason and records failure in ledger', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'SAFETY',
                content: { parts: [{ text: '' }] }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createRequest(validV2Body);
      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(502);
      const data = await res.json();
      expect(data.code).toBe('unavailable');

      expect(mockRpc).toHaveBeenCalledWith('ohmi_fail_ai', expect.objectContaining({
        p_request_id: validV2Body.requestId,
        p_error_code: 'safety'
      }));
    });

    it('rejects malformed result JSON from provider and calls ohmi_fail_ai', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: 'This is plain text, not valid JSON.' }] }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createRequest(validV2Body);
      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(502);
      const data = await res.json();
      expect(data.code).toBe('unavailable');

      expect(mockRpc).toHaveBeenCalledWith('ohmi_fail_ai', expect.objectContaining({
        p_request_id: validV2Body.requestId,
        p_error_code: 'invalid_circuit_check'
      }));
    });

    it('rejects invalid schema structure from provider (e.g. invalid step numbers) and fails cleanly', async () => {
      const invalidResult = {
        ...mockV2CircuitResult,
        steps: [
          {
            step: 5, // Not 1! Must be 1-based sequential
            instruction: 'Step 5',
            why: 'Why',
            check: 'Check'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: JSON.stringify(invalidResult) }] }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createRequest(validV2Body);
      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(502);
      const data = await res.json();
      expect(data.error).toContain('Step index must be sequential 1-based');

      expect(mockRpc).toHaveBeenCalledWith('ohmi_fail_ai', expect.objectContaining({
        p_request_id: validV2Body.requestId,
        p_error_code: 'invalid_circuit_check'
      }));
    });

    it('handles reservation conflict on modified parameters with 409', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'ohmi_reserve_ai') {
          return Promise.resolve({
            data: null,
            error: { message: 'replay does not match input hash' }
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const req = createRequest(validV2Body);
      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('conflict');
      expect(data.error).toContain('different parameters');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles in-progress reservation with 429 and retry-after header', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'ohmi_reserve_ai') {
          return Promise.resolve({
            data: { fresh: false, status: 'pending' },
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const req = createRequest(validV2Body);
      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.code).toBe('in_progress');
      expect(res.headers.get('Retry-After')).toBe('10');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('replays exact completed result with resultId and conversationId without calling provider', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'ohmi_reserve_ai') {
          return Promise.resolve({
            data: {
              fresh: false,
              status: 'completed',
              result_id: '11111111-1111-1111-1111-111111111111',
              conversation_id: '33333333-3333-3333-3333-333333333333'
            },
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            payload: mockV2CircuitResult
          },
          error: null
        })
      });

      const req = createRequest({ ...validV2Body, conversationId: '33333333-3333-3333-3333-333333333333' });
      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.resultId).toBe('11111111-1111-1111-1111-111111111111');
      expect(data.conversationId).toBe('33333333-3333-3333-3333-333333333333');
      expect(data.result).toEqual(mockV2CircuitResult);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns 404 unavailable when replaying a deleted circuit check without calling provider', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'ohmi_reserve_ai') {
          return Promise.resolve({
            data: {
              fresh: false,
              status: 'completed',
              result_id: '11111111-1111-1111-1111-111111111111'
            },
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null, // Analysis row was deleted!
          error: null
        })
      });

      const req = createRequest(validV2Body);
      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.code).toBe('unavailable');
      expect(data.error).toContain('deleted');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('accepts requirementText, parses manual items, and validates comparisons', async () => {
      const mockResultWithManualComp = {
        ...mockV2CircuitResult,
        comparisons: [
          {
            requirementId: 'manual-1',
            status: 'supported',
            explanation: 'LED pin 13 is configured as OUTPUT in setup.',
            evidence: [{ kind: 'code', startLine: 1, endLine: 1 }]
          }
        ]
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: JSON.stringify(mockResultWithManualComp) }] }
              }
            ],
            usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 100 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createRequest({
        ...validV2Body,
        requirementText: 'Use pin 13 for LED control'
      });

      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result.comparisons).toHaveLength(1);
      expect(data.result.comparisons[0].requirementId).toBe('manual-1');
    });

    it('extracts multiple visible text parts while excluding thought parts', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [
                    { thought: true, text: 'Secret internal reasoning that should not be visible' },
                    { text: 'A resistor limits current. ' },
                    { text: 'Connect it in series with the LED.' }
                  ]
                }
              }
            ],
            usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 40 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createRequest({
        version: 1,
        requestId: '00000000-0000-0000-0000-000000000010',
        operation: 'chat',
        language: 'english',
        message: 'What does a resistor do?'
      });

      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result.answer).toBe('A resistor limits current. Connect it in series with the LED.');
      expect(data.result.answer).not.toContain('Secret internal reasoning');
    });

    it('returns a readable synopsis instead of raw JSON string as tutorial answer', async () => {
      const tutorialJson = {
        status: 'tutorial',
        title: 'Blink an LED',
        objective: 'Learn series resistors',
        steps: [
          { step: 1, instruction: 'Place LED', why: 'Visual indicator', check: 'Check orientation' }
        ]
      };

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: JSON.stringify(tutorialJson) }] }
              }
            ],
            usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 80 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = createRequest({
        version: 1,
        requestId: '00000000-0000-0000-0000-000000000011',
        operation: 'tutorial',
        language: 'english',
        message: 'Build guide'
      });

      const res = await handleAiRequest(req, {
        env: defaultEnv,
        createClient: createMockClientFactory(),
        fetch: mockFetch
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result.steps).toHaveLength(1);
      expect(data.result.answer).toBe('Here is your step-by-step guide for Blink an LED with 1 steps.');
      expect(data.result.answer.startsWith('{')).toBe(false);
    });
  });
});
