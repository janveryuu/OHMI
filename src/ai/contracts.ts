import type { Analysis } from '../../supabase/functions/_shared/ai-core';
export type Conversation = { id: string; title: string; analysis_id: string | null; updated_at: string };
export type AiMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string; request_id: string };
export type SavedAnalysis = { id: string; assignment_id: string; language: string; payload: Analysis; model: string; created_at: string };
export type Tutorial = { analysis: SavedAnalysis; currentStep: number; completed: number[] };
