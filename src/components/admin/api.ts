// ============================================================================
// File: src/components/admin/api.ts
// Purpose: Typed fetch helpers for the admin SPA. Re-exports the shared fetch
//          client (src/lib/fetch-client.ts) so the admin and customer SPAs
//          share a single source of truth for request / error / toast logic.
// Role: Re-used by every admin view component — never call fetch() directly.
// ============================================================================

export { ApiError, api, run } from "@/lib/fetch-client";
