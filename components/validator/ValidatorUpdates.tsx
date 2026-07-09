import React, { FC, FormEvent, useCallback, useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { validatorI } from './interfaces';
import { useValidatorAuth } from '../../lib/validatorAuth';
import {
    ValidatorUpdate,
    UpdateTag,
    UpdateDraft,
    UPDATE_BODY_MAX,
    UPDATE_TITLE_MAX,
    listUpdates,
    createUpdate,
    editUpdate,
    deleteUpdate
} from '../../lib/validatorUpdates';

const TAG_LABEL: Record<UpdateTag, { label: string; className: string }> = {
    announcement: { label: 'Announcement', className: 'sw-update-tag-info' },
    incident: { label: 'Incident', className: 'sw-update-tag-warn' },
    roadmap: { label: 'Roadmap', className: 'sw-update-tag-cyan' },
    community: { label: 'Community', className: 'sw-update-tag-gold' }
};

const TAG_ORDER: UpdateTag[] = ['announcement', 'incident', 'roadmap', 'community'];

const timeAgo = (iso: string): string => {
    const date = new Date(iso);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days < 30) return days + 'd ago';
    return date.toLocaleDateString();
};

const shorten = (s: string, chars = 4) => s ? s.slice(0, chars) + '…' + s.slice(-chars) : '';

const emptyDraft: UpdateDraft = { title: '', body: '', tag: 'announcement' };

const UpdateComposer: FC<{
    show: boolean;
    editing: ValidatorUpdate | null;
    validatorName: string;
    onSave: (draft: UpdateDraft) => Promise<void>;
    onHide: () => void;
}> = ({ show, editing, validatorName, onSave, onHide }) => {
    const [draft, setDraft] = useState<UpdateDraft>(emptyDraft);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (show) {
            setDraft(editing
                ? { title: editing.title || '', body: editing.body, tag: editing.tag }
                : emptyDraft);
            setError(null);
        }
    }, [show, editing]);

    const bodyLength = draft.body.length;
    const valid = draft.body.trim().length > 0
        && bodyLength <= UPDATE_BODY_MAX
        && (draft.title || '').length <= UPDATE_TITLE_MAX;

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        setError(null);
        try {
            await onSave(draft);
            onHide();
        } catch (err: any) {
            setError(err?.message || 'Could not save the update. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal show={show} onHide={saving ? undefined : onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title as="h5">
                    {editing ? 'Edit update' : 'Post an update'}
                </Modal.Title>
            </Modal.Header>
            <form onSubmit={submit} className="sw-update-form">
                <Modal.Body>
                    <p className="sw-updates-sub mb-3">
                        This will be shown publicly on {validatorName || 'your validator'}&apos;s profile.
                    </p>
                    <div className="mb-3">
                        <label className="form-label">Type</label>
                        <div className="sw-update-tag-picker" role="radiogroup" aria-label="Update type">
                            {TAG_ORDER.map(tag => (
                                <button
                                    type="button"
                                    key={tag}
                                    role="radio"
                                    aria-checked={draft.tag === tag}
                                    className={'sw-update-tag-option' + (draft.tag === tag ? ' sw-update-tag-option-active' : '')}
                                    onClick={() => setDraft(d => ({ ...d, tag }))}
                                >
                                    {TAG_LABEL[tag].label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mb-3">
                        <label className="form-label" htmlFor="sw-update-title">Title <span className="text-secondary fw-normal">(optional)</span></label>
                        <input
                            id="sw-update-title"
                            className="form-control"
                            type="text"
                            maxLength={UPDATE_TITLE_MAX}
                            value={draft.title}
                            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                            placeholder="e.g. Scheduled maintenance this weekend"
                        />
                    </div>
                    <div className="mb-2">
                        <label className="form-label" htmlFor="sw-update-body">Update</label>
                        <textarea
                            id="sw-update-body"
                            className="form-control"
                            rows={5}
                            value={draft.body}
                            onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
                            placeholder="Let your stakers know what's happening…"
                        />
                        <div className={'sw-update-charcount' + (bodyLength > UPDATE_BODY_MAX ? ' sw-update-charcount-over' : '')}>
                            {bodyLength.toLocaleString()} / {UPDATE_BODY_MAX.toLocaleString()}
                        </div>
                    </div>
                    {error ? <div className="sw-owner-error">{error}</div> : null}
                </Modal.Body>
                <Modal.Footer>
                    <button type="button" className="btn sw-btn-ghost" onClick={onHide} disabled={saving}>
                        Cancel
                    </button>
                    <button type="submit" className="btn sw-btn-primary" disabled={!valid || saving}>
                        {saving ? 'Saving…' : (editing ? 'Save changes' : 'Publish update')}
                    </button>
                </Modal.Footer>
            </form>
        </Modal>
    );
};

const ValidatorUpdates: FC<{ validator: validatorI }> = ({ validator }) => {
    const { isOwnerOf, session } = useValidatorAuth();
    const [updates, setUpdates] = useState<ValidatorUpdate[]>([]);
    const [composerOpen, setComposerOpen] = useState(false);
    const [editing, setEditing] = useState<ValidatorUpdate | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const isOwner = isOwnerOf(validator);

    const refresh = useCallback(() => {
        listUpdates(validator.vote_identity)
            .then(setUpdates)
            .catch(() => setUpdates([]));
    }, [validator.vote_identity]);

    useEffect(() => { refresh(); }, [refresh]);

    const save = async (draft: UpdateDraft) => {
        if (!session) throw new Error('Your owner session expired — please verify your wallet again.');
        if (editing) {
            await editUpdate(validator.vote_identity, editing.id, draft, session);
        } else {
            await createUpdate(validator.vote_identity, draft, session);
        }
        refresh();
    };

    const remove = async (id: string) => {
        if (!session) return;
        await deleteUpdate(validator.vote_identity, id, session);
        setConfirmDelete(null);
        refresh();
    };

    return (
        <section className="sw-updates">
            <div className="sw-updates-head">
                <div>
                    <h3 className="sw-updates-title">Updates from the operator</h3>
                    <p className="sw-updates-sub">
                        Announcements, incident reports and roadmap posts from{' '}
                        {validator.name ? <strong>{validator.name}</strong> : 'this validator'}.
                    </p>
                </div>
                {isOwner ? (
                    <button
                        type="button"
                        className="btn sw-btn-primary sw-updates-post"
                        onClick={() => { setEditing(null); setComposerOpen(true); }}
                    >
                        <i className="bi bi-plus-lg me-2" /> Post an update
                    </button>
                ) : null}
            </div>

            {updates.length === 0 ? (
                <div className="sw-updates-empty">
                    <div className="sw-updates-empty-icon"><i className="bi bi-megaphone" /></div>
                    <div className="sw-updates-empty-body">
                        <div className="sw-updates-empty-title">No updates yet</div>
                        <p className="sw-updates-empty-copy">
                            {isOwner
                                ? 'You manage this profile — post an update to let stakers know about incidents, upgrades or roadmap plans.'
                                : 'Once the operator claims this profile they can post announcements, incident reports and roadmap updates here. Follow via alerts to be notified.'}
                        </p>
                    </div>
                </div>
            ) : (
                <ol className="sw-updates-list">
                    {updates.map(u => {
                        const tag = TAG_LABEL[u.tag];
                        return (
                            <li key={u.id} className="sw-update">
                                <div className="sw-update-meta">
                                    {tag ? <span className={'sw-update-tag ' + tag.className}>{tag.label}</span> : null}
                                    <span className="sw-update-time">{timeAgo(u.created_at)}</span>
                                    {u.updated_at ? <span className="sw-update-edited">edited</span> : null}
                                    {isOwner ? (
                                        <span className="sw-update-actions">
                                            <button
                                                type="button"
                                                className="sw-update-action-btn"
                                                aria-label="Edit update"
                                                onClick={() => { setEditing(u); setComposerOpen(true); }}
                                            >
                                                <i className="bi bi-pencil" />
                                            </button>
                                            {confirmDelete === u.id ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="sw-update-action-btn sw-update-action-btn-danger"
                                                        onClick={() => remove(u.id)}
                                                    >
                                                        Confirm delete
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="sw-update-action-btn"
                                                        onClick={() => setConfirmDelete(null)}
                                                    >
                                                        Keep
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="sw-update-action-btn sw-update-action-btn-danger"
                                                    aria-label="Delete update"
                                                    onClick={() => setConfirmDelete(u.id)}
                                                >
                                                    <i className="bi bi-trash" />
                                                </button>
                                            )}
                                        </span>
                                    ) : null}
                                </div>
                                {u.title ? <div className="sw-update-title">{u.title}</div> : null}
                                <div className="sw-update-body">{u.body}</div>
                                <div className="sw-update-author">— {validator.name || 'Operator'} ({shorten(u.author_pubkey)})</div>
                            </li>
                        );
                    })}
                </ol>
            )}

            <UpdateComposer
                show={composerOpen}
                editing={editing}
                validatorName={validator.name}
                onSave={save}
                onHide={() => { setComposerOpen(false); setEditing(null); }}
            />
        </section>
    );
};

export default ValidatorUpdates;
