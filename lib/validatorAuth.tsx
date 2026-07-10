import React, { FC, ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { validatorI } from '../components/validator/interfaces';

/**
 * Sign-in with Solana for validator profile management.
 *
 * A validator owner connects the wallet designated as the profile owner and
 * signs a human-readable message (no transaction, no fees). The signed message
 * is kept client-side as a session and attached to profile-management API
 * calls so the backend can verify the caller controls the owner key.
 *
 * TEST MODE: until the v2 API exposes an `owner_pubkey` per validator, every
 * validator resolves to TEST_OWNER_PUBKEY below so the full flow can be
 * exercised end-to-end. Replace getValidatorOwnerPubkey's fallback once the
 * API ships the real field.
 */

export const TEST_OWNER_PUBKEY = 'CBS44H1zS2pp3uRQjkj1B6Hm76dsmr7JAYhTPwpeXYYL';

export const getValidatorOwnerPubkey = (validator: validatorI | null): string | null => {
    if (!validator) return null;
    // v2 API will return the authorized owner per validator; prefer it when present.
    if ((validator as any).owner_pubkey) return (validator as any).owner_pubkey;
    return TEST_OWNER_PUBKEY;
};

export interface OwnerSession {
    pubkey: string;
    message: string;
    signature: string; // base58
    issuedAt: string;
    expiresAt: string;
}

interface ValidatorAuthContextI {
    connectedPubkey: string | null;
    session: OwnerSession | null;
    signedIn: boolean;
    signingIn: boolean;
    error: string | null;
    signIn: () => Promise<boolean>;
    signOut: () => void;
    isOwnerOf: (validator: validatorI | null) => boolean;
    canSignInAsOwnerOf: (validator: validatorI | null) => boolean;
}

const SESSION_KEY = 'stakewiz_owner_session';
const SESSION_TTL_HOURS = 24;

const buildSignInMessage = (pubkey: string, nonce: string, issuedAt: string, expiresAt: string): string => {
    return 'stakewiz.com wants you to sign in with your Solana account:\n'
        + pubkey + '\n\n'
        + 'Sign in to manage your validator profile on Stakewiz. '
        + 'This request will not trigger a blockchain transaction or cost any fees.\n\n'
        + 'Nonce: ' + nonce + '\n'
        + 'Issued At: ' + issuedAt + '\n'
        + 'Expiration Time: ' + expiresAt;
};

const makeNonce = (): string => {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
    return bs58.encode(bytes);
};

const verifySession = (session: OwnerSession): boolean => {
    try {
        if (new Date(session.expiresAt).getTime() < Date.now()) return false;
        const pubkeyBytes = new PublicKey(session.pubkey).toBytes();
        const messageBytes = new TextEncoder().encode(session.message);
        const signatureBytes = bs58.decode(session.signature);
        return nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
    } catch (e) {
        return false;
    }
};

const loadStoredSession = (): OwnerSession | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw) as OwnerSession;
        if (!verifySession(session)) {
            window.localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session;
    } catch (e) {
        return null;
    }
};

const ValidatorAuthContext = createContext<ValidatorAuthContextI>({
    connectedPubkey: null,
    session: null,
    signedIn: false,
    signingIn: false,
    error: null,
    signIn: async () => false,
    signOut: () => {},
    isOwnerOf: () => false,
    canSignInAsOwnerOf: () => false
});

export const ValidatorAuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { publicKey, signMessage, connected } = useWallet();
    const [session, setSession] = useState<OwnerSession | null>(null);
    const [signingIn, setSigningIn] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const connectedPubkey = connected && publicKey ? publicKey.toBase58() : null;

    // Restore a previously signed session once the app is mounted client-side.
    useEffect(() => {
        setSession(loadStoredSession());
    }, []);

    // A session only remains active while the same wallet stays connected.
    const activeSession = session && connectedPubkey === session.pubkey ? session : null;

    const signIn = useCallback(async (): Promise<boolean> => {
        setError(null);
        if (!publicKey || !signMessage) {
            setError('Connect a wallet that supports message signing to continue.');
            return false;
        }
        setSigningIn(true);
        try {
            const pubkey = publicKey.toBase58();
            const issuedAt = new Date().toISOString();
            const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
            const message = buildSignInMessage(pubkey, makeNonce(), issuedAt, expiresAt);
            const signature = await signMessage(new TextEncoder().encode(message));

            const newSession: OwnerSession = {
                pubkey,
                message,
                signature: bs58.encode(signature),
                issuedAt,
                expiresAt
            };

            if (!verifySession(newSession)) {
                setError('Signature verification failed. Please try again.');
                return false;
            }

            window.localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
            setSession(newSession);
            return true;
        } catch (e: any) {
            // User rejecting in the wallet is a normal path, not an error state worth shouting about.
            const message = (e && e.message) ? e.message : 'Signing failed';
            setError(/reject|cancel|denied/i.test(message) ? null : message);
            return false;
        } finally {
            setSigningIn(false);
        }
    }, [publicKey, signMessage]);

    const signOut = useCallback(() => {
        if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_KEY);
        setSession(null);
        setError(null);
    }, []);

    const isOwnerOf = useCallback((validator: validatorI | null): boolean => {
        const owner = getValidatorOwnerPubkey(validator);
        return !!owner && !!activeSession && activeSession.pubkey === owner;
    }, [activeSession]);

    const canSignInAsOwnerOf = useCallback((validator: validatorI | null): boolean => {
        const owner = getValidatorOwnerPubkey(validator);
        return !!owner && !!connectedPubkey && connectedPubkey === owner && !isOwnerOf(validator);
    }, [connectedPubkey, isOwnerOf]);

    const value = useMemo<ValidatorAuthContextI>(() => ({
        connectedPubkey,
        session: activeSession,
        signedIn: !!activeSession,
        signingIn,
        error,
        signIn,
        signOut,
        isOwnerOf,
        canSignInAsOwnerOf
    }), [connectedPubkey, activeSession, signingIn, error, signIn, signOut, isOwnerOf, canSignInAsOwnerOf]);

    return (
        <ValidatorAuthContext.Provider value={value}>
            {children}
        </ValidatorAuthContext.Provider>
    );
};

export const useValidatorAuth = () => useContext(ValidatorAuthContext);
