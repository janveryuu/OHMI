import type { Preferences } from '../preview';

export type Profile = { id: string; display_name: string; language: Preferences['language'] };
export type Assignment = { id: string; original_name: string; mime_type: string; size_bytes: number; status: 'pending' | 'ready'; created_at: string };
export type AssignmentStep = { id: string; assignment_id: string; title: string; completed: boolean; created_at: string };
export type AccountState = { configured: boolean; user: { id: string; email: string } | null; profile: Profile | null; assignments: Assignment[]; recovery: boolean; storageError?: string };
export type UploadAuthorization = { id: string; url: string; key: string; token: string; mime: string };
export type Response<T> = { ok: true; data: T } | { ok: false; error: string };

export type AiOperation = 'chat' | 'image' | 'pdf' | 'tutorial';
export type AiLanguage = 'english' | 'filipino' | 'taglish';

export type CalculationType = 'ohms_law' | 'led_resistor' | 'series_resistance' | 'parallel_resistance' | 'resistor_power';

export interface AiCalculationPayload {
  type: CalculationType;
  operands: Record<string, any>;
}

export interface AiCalculationResult {
  operation: CalculationType;
  valid: boolean;
  values: Record<string, number>;
  formatted: Record<string, string>;
  notes?: string;
  error?: string;
}

export interface ArduinoValidationResult {
  valid: boolean;
  hasSetup: boolean;
  hasLoop: boolean;
  warnings: string[];
  declaredPins: number[];
}

export interface AiRequestPayload {
  version: 1;
  requestId: string;
  operation?: AiOperation;
  language: AiLanguage;
  message: string;
  code?: string;
  context?: Array<{ role: 'user' | 'assistant'; text: string }>;
  calculation?: AiCalculationPayload;
  assignmentId?: string;
  conversationId?: string;
  accountId: string;
}

export interface AiResponseData {
  ok: boolean;
  requestId: string;
  accountId: string;
  operation: AiOperation;
  language: AiLanguage;
  result: {
    status: 'answer' | 'needs_clarification' | 'unsupported';
    answer: string;
    questions?: string[];
    calculation?: AiCalculationResult;
    arduinoValidation?: ArduinoValidationResult;
  };
  model: string;
}

export interface ConversationHeader {
  id: string;
  title: string;
  analysis_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  position: number;
  created_at: string;
  structured_result?: any;
}

export interface AnalysisRecord {
  id: string;
  assignment_id: string | null;
  language: string;
  payload: any;
  model: string;
  schema_version: number;
  artifact_kind: 'analysis' | 'tutorial';
  provider: string;
  source_hash: string | null;
  prompt_version: number;
  fingerprint: string | null;
  title: string | null;
  created_at: string;
}

export interface TutorialProgress {
  analysis_id: string;
  current_step: number;
  completed: number[];
  updated_at: string;
}
