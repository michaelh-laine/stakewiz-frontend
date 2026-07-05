import React, { FC, useEffect, useState } from 'react';
import Link from 'next/link';
import { validatorI } from '../validator/interfaces';
import { RenderImage, RenderName } from '../validator/common';

export const RECENT_KEY = 'stakewiz.recentValidators';
export const RECENT_MAX = 8;

export const pushRecentValidator = (voteIdentity: string) => {
    if (typeof window === 'undefined' || !voteIdentity) return;
    try {
        const raw = window.localStorage.getItem(RECENT_KEY);
        const list: string[] = raw ? JSON.parse(raw) : [];
        const next = [voteIdentity, ...list.filter(v => v !== voteIdentity)].slice(0, RECENT_MAX);
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch (e) {}
};

const RecentlyViewed: FC<{ validators: validatorI[] | null }> = ({ validators }) => {
    const [recent, setRecent] = useState<validatorI[]>([]);

    useEffect(() => {
        if (typeof window === 'undefined' || !validators) return;
        try {
            const raw = window.localStorage.getItem(RECENT_KEY);
            if (!raw) return;
            const list: string[] = JSON.parse(raw);
            const map = new Map(validators.map(v => [v.vote_identity, v]));
            const hydrated = list.map(id => map.get(id)).filter(Boolean) as validatorI[];
            setRecent(hydrated);
        } catch (e) {}
    }, [validators]);

    if (recent.length === 0) return null;

    return (
        <section className="sw-recent" aria-label="Recently viewed validators">
            <div className="sw-recent-head">
                <span className="sw-eyebrow">Recently viewed</span>
                <button
                    type="button"
                    className="sw-link sw-recent-clear"
                    onClick={() => {
                        try { window.localStorage.removeItem(RECENT_KEY); } catch (e) {}
                        setRecent([]);
                    }}
                >
                    <i className="bi bi-x me-1" /> Clear
                </button>
            </div>
            <div className="sw-recent-strip">
                {recent.map(v => (
                    <Link key={v.vote_identity} href={'/validator/' + v.vote_identity} passHref legacyBehavior>
                        <a className="sw-recent-chip">
                            <RenderImage img={v.image} vote_identity={v.vote_identity} size={28} />
                            <span className="sw-recent-name"><RenderName validator={v} /></span>
                            <span className={'sw-recent-metric' + (v.delinquent ? ' sw-recent-metric-warn' : '')}>
                                {v.delinquent ? 'DELINQ' : v.wiz_score + '%'}
                            </span>
                        </a>
                    </Link>
                ))}
            </div>
        </section>
    );
};

export default RecentlyViewed;
