import React, { FC, useMemo } from 'react';
import Link from 'next/link';
import ordinal from 'ordinal';
import { validatorI } from '../validator/interfaces';
import { RenderImage, RenderName } from '../validator/common';
import config from '../../config.json';

const HighlightCard: FC<{
    title: string;
    icon: string;
    accent: 'gold' | 'cyan' | 'magenta';
    metric: string;
    metricLabel: string;
    validator: validatorI;
}> = ({ title, icon, accent, metric, metricLabel, validator }) => (
    <div className={'sw-highlight-card sw-highlight-' + accent}>
        <div className="sw-highlight-header">
            <div className="sw-highlight-tag"><i className={'bi ' + icon + ' me-2'} />{title}</div>
            <div className="sw-highlight-rank">{ordinal(validator.rank)}</div>
        </div>
        <Link href={'/validator/' + validator.vote_identity} passHref legacyBehavior>
            <a className="sw-highlight-body no-underline">
                <div className="sw-highlight-logo">
                    <RenderImage img={validator.image} vote_identity={validator.vote_identity} size={56} />
                </div>
                <div className="sw-highlight-name">
                    <RenderName validator={validator} />
                    {validator.is_jito ? <span className="sw-pill sw-pill-jito ms-2">JITO</span> : null}
                </div>
            </a>
        </Link>
        <div className="sw-highlight-metric">
            <div className="sw-highlight-metric-value">{metric}</div>
            <div className="sw-highlight-metric-label">{metricLabel}</div>
        </div>
        <div className="sw-highlight-meta">
            <div><span className="sw-meta-label">Wiz</span><span className="sw-meta-value">{validator.wiz_score}%</span></div>
            <div><span className="sw-meta-label">APY</span><span className="sw-meta-value">{validator.total_apy}%</span></div>
            <div><span className="sw-meta-label">Comm.</span><span className="sw-meta-value">{validator.commission}%</span></div>
        </div>
    </div>
);

const Highlights: FC<{ validators: validatorI[] | null }> = ({ validators }) => {
    const picks = useMemo(() => {
        if (!validators || validators.length === 0) return null;
        const eligible = validators.filter(v => !v.delinquent);
        const topScore = [...eligible].sort((a, b) => a.rank - b.rank)[0];
        const topApy = [...eligible].filter(v => v.commission <= 10 && v.wiz_score >= 70 && v.stake_ratio < config.STAKE_CATEGORIES.HIGH).sort((a, b) => b.total_apy - a.total_apy)[0];
        const topDecentralization = [...eligible].filter(v => v.wiz_score >= 80 && v.stake_ratio < config.STAKE_CATEGORIES.MEDIUM && v.commission <= 10).sort((a, b) => a.activated_stake - b.activated_stake)[0];
        return { topScore, topApy, topDecentralization };
    }, [validators]);

    if (!picks) return null;

    return (
        <section className="sw-highlights">
            <div className="sw-section-heading">
                <h2 className="sw-section-title">Tonight&rsquo;s top picks</h2>
                <p className="sw-section-sub">Curated based on the Stakewiz score and live network metrics. Click a card to dive in.</p>
            </div>
            <div className="sw-highlight-grid">
                {picks.topScore ? <HighlightCard title="Top Wiz Score" icon="bi-trophy-fill" accent="gold" metric={picks.topScore.wiz_score + '%'} metricLabel="Wiz Score" validator={picks.topScore} /> : null}
                {picks.topApy ? <HighlightCard title="Best APY" icon="bi-graph-up-arrow" accent="cyan" metric={picks.topApy.total_apy + '%'} metricLabel="True APY" validator={picks.topApy} /> : null}
                {picks.topDecentralization ? <HighlightCard title="Decentralize the chain" icon="bi-diagram-3-fill" accent="magenta" metric={'◎ ' + new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(picks.topDecentralization.activated_stake)} metricLabel="Activated stake" validator={picks.topDecentralization} /> : null}
            </div>
        </section>
    );
};

export default Highlights;
