import type { Preferences } from '../preview';
export type Profile = { id: string; display_name: string; language: Preferences['language'] };
export type Assignment = { id: string; original_name: string; mime_type: string; size_bytes: number; status: 'pending' | 'ready'; created_at: string };
export type AssignmentStep = { id: string; assignment_id: string; title: string; completed: boolean; created_at: string };
export type AccountState = { configured: boolean; user: { id: string; email: string } | null; profile: Profile | null; assignments: Assignment[]; recovery: boolean; storageError?: string };
export type UploadAuthorization = { id: string; url: string; key: string; token: string; mime: string };
export type Response<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
