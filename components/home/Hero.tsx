import React, { FC } from 'react';
import { clusterStatsI, validatorI, EpochInfoI } from '../validator/interfaces';

const formatStake = (sol: number): string => {
    if (!sol) return '–';
    if (sol >= 1_000_000) return (sol / 1_000_000).toFixed(2) + 'M';
    if (sol >= 1_000) return (sol / 1_000).toFixed(1) + 'K';
    return sol.toFixed(0);
};

const StatCard: FC<{ label: string; value: string; sub?: string; accent?: 'primary' | 'success' | 'warning' | 'info' }> = ({ label, value, sub, accent = 'primary' }) => (
    <div className={'sw-stat-card sw-stat-card-' + accent}>
        <div className="sw-stat-label">{label}</div>
        <div className="sw-stat-value">{value}</div>
        {sub ? <div className="sw-stat-sub">{sub}</div> : null}
    </div>
);

const Hero: FC<{
    validators: validatorI[] | null;
    clusterStats: clusterStatsI | null;
    epochInfo: EpochInfoI | null;
    onScrollToList: () => void;
    onOpenAdvanced: () => void;
}> = ({ validators, clusterStats, epochInfo, onScrollToList, onOpenAdvanced }) => {
    const totalValidators = validators ? validators.length : null;
    const activeValidators = validators ? validators.filter(v => !v.delinquent).length : null;
    const totalStake = validators ? validators.reduce((acc, v) => acc + (v.activated_stake || 0), 0) : null;
    const jitoCount = validators ? validators.filter(v => v.is_jito).length : null;

    return (
        <section className="sw-hero">
            <div className="sw-hero-inner">
                <div className="sw-hero-content">
                    <div className="sw-hero-eyebrow">
                        <span className="sw-hero-pulse" /> Live Solana validator analytics
                    </div>
                    <h1 className="sw-hero-title">
                        Stake smarter.<br />
                        <span className="sw-hero-title-accent">Pick the right validator.</span>
                    </h1>
                    <p className="sw-hero-sub">
                        Stakewiz scores every Solana validator on performance, decentralization,
                        commission and MEV — so you can stake with confidence in seconds.
                    </p>
                    <div className="sw-hero-cta">
                        <button type="button" className="btn sw-btn-primary btn-lg" onClick={onScrollToList}>
                            <i className="bi bi-search me-2" /> Browse validators
                        </button>
                        <button type="button" className="btn sw-btn-ghost btn-lg" onClick={onOpenAdvanced}>
                            <i className="bi bi-sliders me-2" /> Find one for me
                        </button>
                    </div>
                </div>
                <div className="sw-hero-stats">
                    <StatCard label="Validators" value={totalValidators !== null ? totalValidators.toString() : '…'} sub={activeValidators !== null ? activeValidators + ' active' : undefined} accent="primary" />
                    <StatCard label="Total stake" value={totalStake !== null ? '◎ ' + formatStake(totalStake) : '…'} sub="Network secured" accent="success" />
                    <StatCard label="Average APY" value={clusterStats ? clusterStats.avg_apy.toFixed(2) + '%' : '…'} sub="10-epoch median" accent="warning" />
                    <StatCard label="Jito MEV" value={jitoCount !== null ? jitoCount.toString() : '…'} sub="MEV-enabled validators" accent="info" />
                    {epochInfo ? (
                        <div className="sw-hero-epoch">
                            <div className="sw-hero-epoch-row">
                                <span>Epoch {epochInfo.epoch}</span>
                                <span>{(epochInfo.slot_height / 432000 * 100).toFixed(1)}%</span>
                            </div>
                            <div className="sw-hero-epoch-bar">
                                <div className="sw-hero-epoch-fill" style={{ width: (epochInfo.slot_height / 432000 * 100) + '%' }} />
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
};

export default Hero;
