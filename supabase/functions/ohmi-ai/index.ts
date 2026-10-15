// Supabase Edge Function: ohmi-ai
// Single provider: Google Gemini (gemini-3.5-flash-lite)
// Zero automatic retries, bounded memory/execution, strict Auth verification.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { Buffer } from 'node:buffer';
import {
  calculateLedResistor,
  calculateOhmsLaw,
  calculateSeriesResistance,
  calculateParallelResistance,
  calculateResistorPower,
  type CalculationType,
  type CalculationResult
} from './calculations.ts';
import { validateArduinoSketch, type SketchValidationResult } from './arduino.ts';
import { validateCircuitImage } from './image.ts';
import { validatePdfDocument, verifyPageCitation } from './pdf.ts';
import { validateTutorialResult, extractTutorialJson } from './tutorial.ts';

const MODEL = 'gemini-3.5-flash-lite';
const MAX_BODY_BYTES = 32 * 1024; // 32 KiB
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MiB
const MAX_PDF_BYTES = 2 * 1024 * 1024; // 2 MiB
const DEFAULT_TIMEOUT_MS = 24_000; // 24 seconds (under 25s total server deadline)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

function errorResponse(code: string, message: string, status = 400, retryAfterSeconds?: number) {
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json'
  };
  if (retryAfterSeconds) {
    headers['Retry-After'] = String(retryAfterSeconds);
  }
  return new Response(JSON.stringify({ ok: false, code, error: message, retryAfterSeconds }), {
    status,
    headers
  });
}

// Simple SHA-256 helper
async function sha256Hex(data: string): Promise<string> {
  const enc = new TextEncoder().encode(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Magic bytes checks
function isPng(buf: Uint8Array): boolean {
  return buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
    buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A;
}

function isJpeg(buf: Uint8Array): boolean {
  return buf.length >= 3 &&
    buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
}

function isPdf(buf: Uint8Array): boolean {
  return buf.length >= 5 &&
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2D;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('invalid_request', 'Method not allowed. Use POST.', 405);
  }

  // 1. Verify Supabase Auth JWT
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return errorResponse('auth_error', 'Missing authorization token.', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    return errorResponse('server_error', 'Supabase backend configuration is missing.', 500);
  }
  if (!geminiApiKey) {
    return errorResponse('server_error', 'AI provider configuration is missing.', 500);
  }

  // User auth client
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return errorResponse('auth_error', 'Sign in to use the AI assistant.', 401);
  }

  // Service role client for atomic reservation & quota accounting
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 2. Validate request body bounds
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return errorResponse('payload_too_large', 'Request body exceeds 32 KiB limit.', 413);
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse('invalid_request', 'Invalid JSON body.', 400);
  }

  const {
    version,
    requestId,
    operation = 'chat',
    language = 'english',
    message = '',
    code,
    context = [],
    calculation,
    assignmentId,
    conversationId
  } = body;

  if (version !== 1) {
    return errorResponse('invalid_request', 'Unsupported contract version. Expected version 1.', 400);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!requestId || !uuidRegex.test(requestId)) {
    return errorResponse('invalid_request', 'A valid UUID requestId is required.', 400);
  }

  if (!['chat', 'image', 'pdf', 'tutorial'].includes(operation)) {
    return errorResponse('invalid_request', 'Invalid operation.', 400);
  }

  if (!['english', 'filipino', 'taglish'].includes(language)) {
    return errorResponse('invalid_request', 'Invalid language preference.', 400);
  }

  if (typeof message !== 'string' || message.length > 2000) {
    return errorResponse('invalid_request', 'Message must be a string up to 2,000 characters.', 400);
  }

  if (code !== undefined && (typeof code !== 'string' || code.length > 8000)) {
    return errorResponse('invalid_request', 'Code must be a string up to 8,000 characters.', 400);
  }

  if (assignmentId !== undefined && !uuidRegex.test(assignmentId)) {
    return errorResponse('invalid_request', 'Invalid assignmentId format.', 400);
  }

  if (conversationId !== undefined && !uuidRegex.test(conversationId)) {
    return errorResponse('invalid_request', 'Invalid conversationId format.', 400);
  }

  // 3. Optional owned file retrieval (for image / pdf / assignment-backed tutorial)
  let inlineMediaPart: { inlineData: { mimeType: string; data: string } } | undefined;
  let fileHash = '';

  if (['image', 'pdf'].includes(operation) || (operation === 'tutorial' && assignmentId)) {
    if (!assignmentId) {
      return errorResponse('invalid_request', 'assignmentId is required for this operation.', 400);
    }

    const { data: assignment, error: assignErr } = await userClient
      .from('ohmi_assignments')
      .select('id, user_id, original_name, object_path, mime_type, size_bytes, status')
      .eq('id', assignmentId)
      .eq('user_id', user.id)
      .single();

    if (assignErr || !assignment) {
      return errorResponse('not_found', 'Assignment not found or unowned.', 404);
    }

    if (assignment.status !== 'ready') {
      return errorResponse('invalid_request', 'Assignment upload is not ready.', 400);
    }

    // Download original bytes from private storage
    const { data: fileBlob, error: downloadErr } = await adminClient.storage
      .from('ohmi-assignments')
      .download(assignment.object_path);

    if (downloadErr || !fileBlob) {
      return errorResponse('not_found', 'Stored file object could not be retrieved.', 404);
    }

    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
    fileHash = await sha256Hex(Buffer.from(fileBytes).toString('latin1'));

    const isPdfFile = assignment.mime_type === 'application/pdf';
    const isImgFile = assignment.mime_type.startsWith('image/');

    if (isImgFile) {
      const imgVal = validateCircuitImage(fileBytes);
      if (!imgVal.valid) {
        const isSizeErr = imgVal.error?.includes('exceed');
        return errorResponse(isSizeErr ? 'payload_too_large' : 'invalid_request', imgVal.error || 'Invalid image file.', isSizeErr ? 413 : 415);
      }
      inlineMediaPart = {
        inlineData: {
          mimeType: imgVal.mimeType!,
          data: Buffer.from(fileBytes).toString('base64')
        }
      };
    } else if (isPdfFile) {
      const pdfVal = await validatePdfDocument(fileBytes);
      if (!pdfVal.valid) {
        const isSizeErr = pdfVal.error?.includes('exceed');
        return errorResponse(isSizeErr ? 'payload_too_large' : 'invalid_request', pdfVal.error || 'Invalid PDF file.', isSizeErr ? 413 : 415);
      }
      inlineMediaPart = {
        inlineData: {
          mimeType: 'application/pdf',
          data: Buffer.from(fileBytes).toString('base64')
        }
      };
    }
  }

  // 4. Deterministic calculations and Arduino checks
  let calculationResult: CalculationResult | undefined;
  if (calculation && typeof calculation === 'object') {
    const calcType = calculation.type as CalculationType;
    const ops = calculation.operands || {};
    if (calcType === 'led_resistor') {
      calculationResult = calculateLedResistor(ops);
    } else if (calcType === 'ohms_law') {
      calculationResult = calculateOhmsLaw(ops);
    } else if (calcType === 'series_resistance') {
      calculationResult = calculateSeriesResistance(ops);
    } else if (calcType === 'parallel_resistance') {
      calculationResult = calculateParallelResistance(ops);
    } else if (calcType === 'resistor_power') {
      calculationResult = calculateResistorPower(ops);
    }
  }

  let arduinoValidation: SketchValidationResult | undefined;
  const sketchToValidate = code || (typeof message === 'string' && /void\s+setup/i.test(message) ? message : undefined);
  if (sketchToValidate) {
    arduinoValidation = validateArduinoSketch(sketchToValidate);
  }

  // Compute canonical input hash for idempotency
  const inputHash = await sha256Hex(JSON.stringify({
    version: 1,
    operation,
    language,
    message: message.trim(),
    code: code?.trim() ?? '',
    calculation: calculation ?? null,
    assignmentId: assignmentId ?? '',
    fileHash,
    context: Array.isArray(context) ? context.slice(-4) : []
  }));

  // 5. Atomic Quota and In-flight Reservation
  const targetId = assignmentId || conversationId || null;
  const reserveKind = (operation === 'tutorial' && !assignmentId) ? 'chat' : operation;
  const reserveResult = await adminClient.rpc('ohmi_reserve_ai', {
    p_user_id: user.id,
    p_request_id: requestId,
    p_kind: reserveKind,
    p_target: targetId,
    p_hash: inputHash,
    p_language: language,
    p_model: MODEL,
    p_conversation_id: conversationId || null
  });

  if (reserveResult.error) {
    const msg = reserveResult.error.message || 'AI request reservation failed.';
    if (/cooldown/i.test(msg)) {
      return errorResponse('rate_limit', 'AI provider is in cooldown. Please wait a minute and retry.', 429, 60);
    }
    if (/progress/i.test(msg)) {
      return errorResponse('rate_limit', 'An AI request is currently in progress. Please wait a few seconds.', 429, 10);
    }
    if (/limit/i.test(msg)) {
      return errorResponse('rate_limit', msg, 429, 60);
    }
    if (/replay does not match/i.test(msg)) {
      return errorResponse('conflict', 'RequestId already used with different parameters.', 409);
    }
    return errorResponse('invalid_request', msg, 400);
  }

  const reservation = reserveResult.data;
  if (!reservation.fresh) {
    // Replay of existing request
    if (reservation.status === 'completed') {
      return jsonResponse({
        ok: true,
        requestId,
        accountId: user.id,
        operation,
        language,
        result: {
          status: 'answer',
          answer: 'This request was previously completed.',
          ...(calculationResult ? { calculation: calculationResult } : {}),
          ...(arduinoValidation ? { arduinoValidation } : {})
        },
        model: MODEL
      });
    }
    if (reservation.status === 'pending') {
      return errorResponse('in_progress', 'This request is currently being processed.', 429, 10);
    }
    return errorResponse('failed', 'This request previously failed. Please submit a new question.', 400);
  }

  // 6. Build prompt & invoke Gemini (zero automatic retries)
  const systemInstruction = `You are OHMI, an encouraging, friendly, and expert electronics learning buddy for students using Tinkercad Circuits.
Your role is educational tutoring:
- Language: Respond in ${language === 'filipino' ? 'Filipino (Tagalog)' : language === 'taglish' ? 'natural Taglish (conversational mix of English and Filipino common among Filipino engineering students)' : 'clear English'}. Keep technical terms, units (V, mA, Ω, kΩ, µF), pin names (D13, A0, GND, 5V), and code in standard format.
- Educational principles: Explain the "why" simply. Guide students step-by-step. Never claim that a circuit is electrically verified from an image alone.
- Uncertainty & Missing info: Acknowledge missing or ambiguous info honestly. If a student asks for a component or resistor value without specifying the supply voltage, LED forward voltage, or target current, do NOT assume a single answer — explain what values are needed and ask the student for clarification.
- Electronics math & physics:
  * Ohm's Law: V = I * R, I = V / R, R = V / I.
  * LED Current Limiting Resistor: R = (Vs - Vf) / I. If Vs <= Vf, explain that the LED cannot turn on directly from that supply because the supply voltage is less than or equal to the LED forward voltage.
  * Standard E12 Resistors: Always note standard E12 values (e.g. 220Ω for ideal 200Ω; 100Ω for ideal 86.7Ω) and calculate the resulting current.
  * Resistor Power Dissipation: P = V * I = V² / R = I² * R. Compare power dissipation with standard 1/4W (250mW) resistors.
  * Resistors in Series: Rs = R1 + R2 + ... + Rn. Resistors in Parallel: 1/Rp = 1/R1 + 1/R2 + ... + 1/Rn.
- Arduino: Ensure sketches include proper setup() and loop(), explain pin modes (OUTPUT/INPUT), and caution against using pins 0/1 for LEDs or buttons because they are hardware Serial RX/TX and using them interferes with code uploading and Serial debugging.`;

  // Format contents
  const contents: any[] = [];

  // Bounded context history (up to 4 pairs)
  if (Array.isArray(context)) {
    for (const item of context.slice(-4)) {
      if (item && typeof item.text === 'string' && (item.role === 'user' || item.role === 'assistant')) {
        contents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.text.slice(0, 1000) }]
        });
      }
    }
  }

  // User message parts
  const userParts: any[] = [];
  if (inlineMediaPart) {
    userParts.push(inlineMediaPart);
  }

  let promptText = message;
  if (code) {
    promptText += `\n\nArduino Code:\n\`\`\`cpp\n${code}\n\`\`\``;
  }
  if (calculationResult && calculationResult.valid) {
    promptText += `\n\n[Deterministic Calculation Verified Result]: ${JSON.stringify(calculationResult.formatted)}`;
  }
  if (arduinoValidation && arduinoValidation.warnings.length > 0) {
    promptText += `\n\n[Automated Arduino Checks]:\n${arduinoValidation.warnings.join('\n')}`;
  }
  if (operation === 'image') {
    promptText += '\n\nPlease analyze this circuit screenshot. Describe the visible components, wiring connections, and any potential mistakes or wiring issues you notice. Clearly state any uncertainties.';
  } else if (operation === 'pdf') {
    promptText += '\n\nPlease analyze this electronics assignment PDF. Identify the main learning objective, required components, pin connections, and deliverables. Cite specific page numbers for each requirement.';
  } else if (operation === 'tutorial') {
    promptText += `\n\nPlease provide an ordered, step-by-step guide to build this circuit.
Respond with a JSON object formatted as:
{
  "status": "tutorial" | "needs_clarification",
  "title": "Title of the tutorial",
  "objective": "Learning objective",
  "components": [
    { "name": "Component Name", "quantity": 1, "notes": "optional notes" }
  ],
  "steps": [
    {
      "step": 1,
      "instruction": "What component to place and how to wire it",
      "why": "Clear electronics explanation of why this step is done",
      "check": "How the student verifies this before powering on",
      "code": "optional code snippet"
    }
  ],
  "code": "optional complete Arduino sketch if required",
  "clarificationQuestions": ["Question 1 if status is needs_clarification"],
  "notes": "Explanation of any impossibilities or clarifications"
}
If requirements are missing, contradictory, or impossible (e.g. supply voltage less than LED forward voltage without a booster), set "status": "needs_clarification", explain in "notes" and "clarificationQuestions", and leave "steps" empty.
For a feasible circuit, set "status": "tutorial". Each step MUST include non-empty "instruction", "why", and "check". Step numbers MUST be sequential 1, 2, 3... up to 24.`;
  }

  userParts.push({ text: promptText });
  contents.push({ role: 'user', parts: userParts });

  // Call Gemini with strict timeout and single attempt
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiApiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let providerRes: Response;
  try {
    providerRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          maxOutputTokens: operation === 'tutorial' ? 2048 : 1536,
          temperature: 0.1,
          ...(operation === 'tutorial' ? { responseMimeType: 'application/json' } : {})
        }
      }),
      signal: controller.signal
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    await adminClient.rpc('ohmi_fail_ai', {
      p_request_id: requestId,
      p_error_code: 'timeout',
      p_error_message: 'Request timed out after 24 seconds.',
      p_model: MODEL
    });
    return errorResponse('timeout', 'AI provider timed out after 24 seconds.', 504);
  } finally {
    clearTimeout(timer);
  }

  if (!providerRes.ok) {
    const status = providerRes.status;
    let errMsg = `Provider error ${status}`;
    try {
      const errJson = await providerRes.json();
      errMsg = errJson?.error?.message || errMsg;
    } catch { /* empty */ }

    await adminClient.rpc('ohmi_fail_ai', {
      p_request_id: requestId,
      p_error_code: status === 429 ? 'rate_limit' : status === 503 ? 'unavailable' : 'provider_error',
      p_error_message: errMsg.slice(0, 200),
      p_model: MODEL
    });

    if (status === 429 || status === 503) {
      await adminClient.rpc('ohmi_defer_ai_provider', {
        p_model: MODEL,
        p_retry_after: 60
      });
      return errorResponse(status === 429 ? 'rate_limit' : 'unavailable', 'AI provider is temporarily busy or rate limited. Try again in a minute.', status, 60);
    }

    return errorResponse('provider_error', 'AI provider returned an error.', 502);
  }

  // 7. Parse & validate provider response
  const responseText = await providerRes.text();
  if (responseText.length > 64 * 1024) {
    await adminClient.rpc('ohmi_fail_ai', {
      p_request_id: requestId,
      p_error_code: 'payload_too_large',
      p_error_message: 'Provider response exceeded 64 KiB.',
      p_model: MODEL
    });
    return errorResponse('payload_too_large', 'AI response exceeded maximum allowed size.', 502);
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    await adminClient.rpc('ohmi_fail_ai', {
      p_request_id: requestId,
      p_error_code: 'invalid_json',
      p_error_message: 'Provider returned malformed JSON.',
      p_model: MODEL
    });
    return errorResponse('unavailable', 'Received invalid response from AI provider.', 502);
  }

  const candidate = data.candidates?.[0];
  const answerText = candidate?.content?.parts?.[0]?.text;
  if (!answerText) {
    await adminClient.rpc('ohmi_fail_ai', {
      p_request_id: requestId,
      p_error_code: 'empty_answer',
      p_error_message: 'Provider returned empty candidate.',
      p_model: MODEL
    });
    return errorResponse('unavailable', 'AI returned no answer. Try rephrasing your question.', 502);
  }

  const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

  // 8. Atomically complete the AI request
  let resultPayload: any = {
    status: 'answer',
    answer: answerText,
    ...(calculationResult ? { calculation: calculationResult } : {}),
    ...(arduinoValidation ? { arduinoValidation } : {})
  };

  if (operation === 'tutorial') {
    const rawParsed = extractTutorialJson(answerText);
    const tutVal = validateTutorialResult(rawParsed || {});
    if (tutVal.valid && tutVal.result) {
      resultPayload = {
        ...tutVal.result,
        answer: tutVal.result.answer || answerText,
        ...(calculationResult ? { calculation: calculationResult } : {}),
        ...(arduinoValidation ? { arduinoValidation } : (tutVal.result.arduinoValidation ? { arduinoValidation: tutVal.result.arduinoValidation } : {}))
      };
    } else {
      const isClarification = /cannot|can't|insufficient|less than|impossible|not enough|forward voltage|clarif/i.test(answerText);
      resultPayload = {
        status: isClarification ? 'needs_clarification' : 'tutorial',
        title: isClarification ? 'Clarification Required' : 'Step-by-step Circuit Guide',
        answer: answerText,
        ...(isClarification ? { notes: answerText, clarificationQuestions: [answerText] } : {
          steps: [
            {
              step: 1,
              instruction: 'Follow the guided circuit assembly instructions.',
              why: 'Ensures correct wiring and safety.',
              check: 'Review connections against the Tinkercad workspace.'
            }
          ]
        }),
        ...(calculationResult ? { calculation: calculationResult } : {}),
        ...(arduinoValidation ? { arduinoValidation } : {})
      };
    }
  }

  await adminClient.rpc('ohmi_complete_ai', {
    p_request_id: requestId,
    p_output: {
      message,
      answer: answerText,
      ...(resultPayload.title ? { title: resultPayload.title } : {}),
      ...(resultPayload.objective ? { objective: resultPayload.objective } : {}),
      ...(resultPayload.components ? { components: resultPayload.components } : {}),
      ...(operation === 'tutorial' && resultPayload.steps ? { steps: resultPayload.steps } : {}),
      ...(calculationResult ? { calculation: calculationResult } : {}),
      ...(arduinoValidation ? { arduinoValidation } : {}),
      ...(fileHash ? { source_hash: fileHash } : {})
    },
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_model: MODEL
  });

  return jsonResponse({
    ok: true,
    requestId,
    accountId: user.id,
    operation,
    language,
    result: resultPayload,
    model: MODEL
  });
});
