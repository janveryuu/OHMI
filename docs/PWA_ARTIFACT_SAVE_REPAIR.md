# Artifact save repair — review before production application

Live PDF analysis reaches Gemini but fails persistence. Hosted logs show PostgreSQL `42703`, and the existing `ohmi_complete_ai` INSERT/ON CONFLICT statement references `updated_at`. Metadata confirms that `public.ohmi_analyses` has no such column. Plain chat succeeds because it does not enter the artifact insertion branch.

Proposed migration: `supabase/migrations/20261024041136_ohmi_analysis_updated_at.sql` adds one `timestamptz NOT NULL DEFAULT now()` column. It preserves every existing record, RLS policy, grant, function signature and provider setting. PostgreSQL 17 supports this additive constant-default operation without rewriting existing rows. A five-second lock timeout prevents prolonged waiting; a timeout leaves the migration unapplied.

Existing records receive the migration transaction's timestamp as their initial `updated_at`; this is not a claim about their historical last modification. Future saves use the existing function's update behavior.

Operational rollback retains the additive column and existing data, restores a compatible client/function deployment, and closes the web AI gate if needed. Do not drop the column or erase generated artifacts as rollback. Existing frontend rollback tag and Supabase migration history remain preserved.

After approval: apply through the migration API; verify the column and history, complete a synthetic pending artifact inside a rolled-back transaction, then retry the approved PDF/circuit/tutorial workflows and rerun privacy/security checks. No paid service or credential change is involved.

Status: owner explicitly approved the additive repair. Applied as migration 20261024041136; metadata confirms timestamptz, NOT NULL and default now(). A synthetic completion is verified inside a rolled-back transaction before live workflow retries.
