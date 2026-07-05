import React, { FC, useEffect, useState } from 'react';
import { validatorI } from './interfaces';

interface Update {
    id: string;
    author: string;
    postedAt: string;
    body: string;
    tag?: 'announcement' | 'incident' | 'roadmap' | 'community';
}

const DEMO_UPDATES: Record<string, Update[]> = {
    // Vote identity → sample updates. In production these come from the API.
    // For any validator not in this map the section renders the empty state.
};

const TAG_LABEL: Record<NonNullable<Update['tag']>, { label: string; className: string }> = {
    announcement: { label: 'Announcement', className: 'sw-update-tag-info' },
    incident: { label: 'Incident', className: 'sw-update-tag-warn' },
    roadmap: { label: 'Roadmap', className: 'sw-update-tag-cyan' },
    community: { label: 'Community', className: 'sw-update-tag-gold' }
};

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

const ValidatorUpdates: FC<{ validator: validatorI; isOwner?: boolean }> = ({ validator, isOwner = false }) => {
    const [updates, setUpdates] = useState<Update[]>([]);

    useEffect(() => {
        setUpdates(DEMO_UPDATES[validator.vote_identity] || []);
    }, [validator.vote_identity]);

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
                    <button type="button" className="btn sw-btn-primary sw-updates-post">
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
                                ? 'You own this profile — post an update to let stakers know about incidents, upgrades or roadmap plans.'
                                : 'Once the operator claims this profile they can post announcements, incident reports and roadmap updates here. Follow via alerts to be notified.'}
                        </p>
                    </div>
                </div>
            ) : (
                <ol className="sw-updates-list">
                    {updates.map(u => {
                        const tag = u.tag ? TAG_LABEL[u.tag] : null;
                        return (
                            <li key={u.id} className="sw-update">
                                <div className="sw-update-meta">
                                    {tag ? <span className={'sw-update-tag ' + tag.className}>{tag.label}</span> : null}
                                    <span className="sw-update-time">{timeAgo(u.postedAt)}</span>
                                </div>
                                <div className="sw-update-body">{u.body}</div>
                                <div className="sw-update-author">— {u.author}</div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
};

export default ValidatorUpdates;
