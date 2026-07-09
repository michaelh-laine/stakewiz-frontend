import axios from 'axios';
import config from '../config.json';
import { OwnerSession } from './validatorAuth';

/**
 * Validator profile updates — announcements, incident reports, roadmap posts
 * written by the validator's owner and shown on the validator profile page.
 *
 * API CONTRACT (proposed for the v2 API, mirrors alert creation):
 *   GET    /v2/validator/{vote_identity}/updates          → ValidatorUpdate[] (public)
 *   POST   /v2/validator/{vote_identity}/updates          → create (owner-signed)
 *   PATCH  /v2/validator/{vote_identity}/updates/{id}     → edit   (owner-signed)
 *   DELETE /v2/validator/{vote_identity}/updates/{id}     → delete (owner-signed)
 *
 * Owner-signed requests carry the sign-in session so the backend can verify
 * the caller controls the validator's owner key:
 *   X-Stakewiz-Pubkey:    base58 wallet pubkey
 *   X-Stakewiz-Message:   base64 of the signed sign-in message
 *   X-Stakewiz-Signature: base58 ed25519 signature over the message
 * The backend must verify (1) the signature matches pubkey+message, (2) the
 * message expiry has not passed, and (3) pubkey equals the validator's
 * owner_pubkey. The v2 validator response additionally needs an owner_pubkey
 * field so the frontend can gate the editing tools.
 *
 * TEST MODE: USE_API is false until the endpoints above exist on the v2 API.
 * Writes still require a valid signed session, but posts persist to
 * localStorage so the whole flow can be exercised in the browser today.
 * Flip USE_API to true (and remove the local store) once the API ships.
 */

const USE_API = false;
const API_URL = process.env.API_BASE_URL;

export type UpdateTag = 'announcement' | 'incident' | 'roadmap' | 'community';

export interface ValidatorUpdate {
    id: string;
    vote_identity: string;
    author_pubkey: string;
    title?: string;
    body: string;
    tag: UpdateTag;
    created_at: string;
    updated_at?: string;
}

export interface UpdateDraft {
    title?: string;
    body: string;
    tag: UpdateTag;
}

export const UPDATE_BODY_MAX = 2000;
export const UPDATE_TITLE_MAX = 120;

const authHeaders = (session: OwnerSession) => ({
    'Content-Type': 'application/json',
    'X-Stakewiz-Pubkey': session.pubkey,
    'X-Stakewiz-Message': typeof window !== 'undefined' ? window.btoa(session.message) : '',
    'X-Stakewiz-Signature': session.signature
});

// ---------------------------------------------------------------------------
// Local test store (browser-only) — stands in for the API in TEST MODE.
// ---------------------------------------------------------------------------

const storeKey = (voteIdentity: string) => 'stakewiz_updates_' + voteIdentity;

const readLocal = (voteIdentity: string): ValidatorUpdate[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(storeKey(voteIdentity));
        return raw ? (JSON.parse(raw) as ValidatorUpdate[]) : [];
    } catch (e) {
        return [];
    }
};

const writeLocal = (voteIdentity: string, updates: ValidatorUpdate[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storeKey(voteIdentity), JSON.stringify(updates));
};

const makeId = (): string => {
    return 'upd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};

// ---------------------------------------------------------------------------
// Public service — components call these regardless of backing store.
// ---------------------------------------------------------------------------

export const listUpdates = async (voteIdentity: string): Promise<ValidatorUpdate[]> => {
    if (USE_API) {
        const response = await axios(API_URL + config.API_ENDPOINTS.validator + '/' + voteIdentity + '/updates', {
            headers: { 'Content-Type': 'application/json' }
        });
        return response.data as ValidatorUpdate[];
    }
    return readLocal(voteIdentity).sort((a, b) => b.created_at.localeCompare(a.created_at));
};

export const createUpdate = async (
    voteIdentity: string,
    draft: UpdateDraft,
    session: OwnerSession
): Promise<ValidatorUpdate> => {
    if (USE_API) {
        const response = await axios.post(
            API_URL + config.API_ENDPOINTS.validator + '/' + voteIdentity + '/updates',
            JSON.stringify(draft),
            { headers: authHeaders(session) }
        );
        return response.data as ValidatorUpdate;
    }
    const update: ValidatorUpdate = {
        id: makeId(),
        vote_identity: voteIdentity,
        author_pubkey: session.pubkey,
        title: draft.title?.trim() || undefined,
        body: draft.body.trim(),
        tag: draft.tag,
        created_at: new Date().toISOString()
    };
    writeLocal(voteIdentity, [update, ...readLocal(voteIdentity)]);
    return update;
};

export const editUpdate = async (
    voteIdentity: string,
    id: string,
    draft: UpdateDraft,
    session: OwnerSession
): Promise<ValidatorUpdate> => {
    if (USE_API) {
        const response = await axios.patch(
            API_URL + config.API_ENDPOINTS.validator + '/' + voteIdentity + '/updates/' + id,
            JSON.stringify(draft),
            { headers: authHeaders(session) }
        );
        return response.data as ValidatorUpdate;
    }
    const updates = readLocal(voteIdentity);
    const index = updates.findIndex(u => u.id === id);
    if (index === -1) throw new Error('Update not found');
    updates[index] = {
        ...updates[index],
        title: draft.title?.trim() || undefined,
        body: draft.body.trim(),
        tag: draft.tag,
        updated_at: new Date().toISOString()
    };
    writeLocal(voteIdentity, updates);
    return updates[index];
};

export const deleteUpdate = async (
    voteIdentity: string,
    id: string,
    session: OwnerSession
): Promise<void> => {
    if (USE_API) {
        await axios.delete(
            API_URL + config.API_ENDPOINTS.validator + '/' + voteIdentity + '/updates/' + id,
            { headers: authHeaders(session) }
        );
        return;
    }
    writeLocal(voteIdentity, readLocal(voteIdentity).filter(u => u.id !== id));
};
