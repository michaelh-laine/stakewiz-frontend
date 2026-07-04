import React, { FC, useMemo } from 'react';
import Link from 'next/link';
import ordinal from 'ordinal';
import { clusterStatsI, EpochInfoI, validatorI } from '../validator/interfaces';
import { RenderImage, RenderName } from '../validator/common';
import config from '../../config.json';

const formatStake = (sol: number): string => {
    if (!sol) return '–';
    if (sol >= 1_000_000) return (sol / 1_000_000).toFixed(2) + 'M';
    if (sol >= 1_000) return (sol / 1_000).toFixed(1) + 'K';
    return sol.toFixed(0);
};

const Kpi: FC<{ label: string; value: string; delta?: string; trend?: 'up' | 'down' | 'flat' }> = ({ label, value, delta, trend }) => (
    <div className="sw-kpi">
        <div className="sw-kpi-label">{label}</div>
        <div className="sw-kpi-value">{value}</div>
        {delta ? (
            <div className={'sw-kpi-delta sw-kpi-delta-' + (trend ?? 'flat')}>
                {trend === 'up' ? <i className="bi bi-arrow-up-short" /> : null}
                {trend === 'down' ? <i className="bi bi-arrow-down-short" /> : null}
                {delta}
            </div>
        ) : null}
    </div>
);

const MiniRow: FC<{ validator: validatorI; metric: string }> = ({ validator, metric }) => (
    <Link href={'/validator/' + validator.vote_identity} passHref legacyBehavior>
        <a className="sw-mini-row no-underline">
            <RenderImage img={validator.image} vote_identity={validator.vote_identity} size={32} />
            <div className="sw-mini-name">
                <RenderName validator={validator} />
                <span className="sw-mini-rank">{ordinal(validator.rank)}</span>
            </div>
            <span className="sw-mini-metric">{metric}</span>
        </a>
    </Link>
);

const Leaderboard: FC<{ title: string; icon: string; rows: { validator: validatorI; metric: string }[] }> = ({ title, icon, rows }) => (
    <div className="sw-leaderboard">
        <div className="sw-leaderboard-title"><i className={'bi ' + icon + ' me-2'} /> {title}</div>
        <div className="sw-leaderboard-rows">
            {rows.map((r, i) => <MiniRow key={i} validator={r.validator} metric={r.metric} />)}
        </div>
    </div>
);

const HomeDashboard: FC<{
    validators: validatorI[] | null;
    clusterStats: clusterStatsI | null;
    epochInfo: EpochInfoI | null;
}> = ({ validators, clusterStats, epochInfo }) => {
    const rows = useMemo(() => {
        if (!validators || validators.length === 0) return null;
        const eligible = validators.filter(v => !v.delinquent);
        return {
            topWiz: [...eligible].sort((a, b) => a.rank - b.rank).slice(0, 5),
            topApy: [...eligible].filter(v => v.commission <= 10 && v.wiz_score >= 70).sort((a, b) => b.total_apy - a.total_apy).slice(0, 5),
            lowComm: [...eligible].filter(v => v.wiz_score >= 80).sort((a, b) => a.commission - b.commission || a.rank - b.rank).slice(0, 5),
            decentralizers: [...eligible].filter(v => v.wiz_score >= 80 && v.commission <= 10 && v.stake_ratio < config.STAKE_CATEGORIES.MEDIUM).sort((a, b) => a.activated_stake - b.activated_stake).slice(0, 5)
        };
    }, [validators]);

    if (!validators) return null;

    const totalStake = validators.reduce((acc, v) => acc + (v.activated_stake || 0), 0);
    const activeValidators = validators.filter(v => !v.delinquent).length;
    const delinquentValidators = validators.length - activeValidators;
    const jitoCount = validators.filter(v => v.is_jito).length;

    return (
        <section className="sw-dashboard">
            <div className="sw-dashboard-head">
                <div>
                    <div className="sw-eyebrow">Stakewiz · Live Dashboard</div>
                    <h1 className="sw-dashboard-title">Solana validator network</h1>
                </div>
                {epochInfo ? (
                    <div className="sw-dashboard-epoch">
                        <div className="sw-dashboard-epoch-row">
                            <span>Epoch {epochInfo.epoch}</span>
                            <span>{(epochInfo.slot_height / config.SLOTS_PER_EPOCH * 100).toFixed(1)}% · {Math.round(epochInfo.remaining_seconds / 3600)}h left</span>
                        </div>
                        <div className="sw-dashboard-epoch-bar">
                            <div className="sw-dashboard-epoch-fill" style={{ width: (epochInfo.slot_height / config.SLOTS_PER_EPOCH * 100) + '%' }} />
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="sw-kpi-grid">
                <Kpi label="Validators" value={validators.length.toString()} delta={activeValidators + ' active'} trend="flat" />
                <Kpi label="Delinquent" value={delinquentValidators.toString()} delta={delinquentValidators > 0 ? 'monitor' : 'all healthy'} trend={delinquentValidators > 0 ? 'down' : 'flat'} />
                <Kpi label="Total stake" value={'◎ ' + formatStake(totalStake)} delta="across cluster" trend="flat" />
                <Kpi label="Avg TrueAPY" value={clusterStats ? clusterStats.avg_apy.toFixed(2) + '%' : '…'} delta="10-epoch median" trend="up" />
                <Kpi label="Avg commission" value={clusterStats ? clusterStats.avg_commission.toFixed(1) + '%' : '…'} delta="cluster average" trend="flat" />
                <Kpi label="Avg skip rate" value={clusterStats ? clusterStats.avg_skip_rate.toFixed(2) + '%' : '…'} delta="lower is better" trend="flat" />
                <Kpi label="Jito-enabled" value={jitoCount.toString()} delta={Math.round(jitoCount / validators.length * 100) + '% of network'} trend="up" />
                <Kpi label="Avg vote rate" value={clusterStats ? clusterStats.avg_credit_ratio.toFixed(1) + '%' : '…'} delta="credits / slots" trend="flat" />
            </div>

            {rows ? (
                <div className="sw-leaderboards">
                    <Leaderboard title="Top Wiz Score" icon="bi-trophy-fill" rows={rows.topWiz.map(v => ({ validator: v, metric: v.wiz_score + '%' }))} />
                    <Leaderboard title="Best TrueAPY" icon="bi-graph-up-arrow" rows={rows.topApy.map(v => ({ validator: v, metric: v.total_apy + '%' }))} />
                    <Leaderboard title="Lowest commission" icon="bi-cash-coin" rows={rows.lowComm.map(v => ({ validator: v, metric: v.commission + '%' }))} />
                    <Leaderboard title="Help decentralize" icon="bi-diagram-3-fill" rows={rows.decentralizers.map(v => ({ validator: v, metric: '◎ ' + formatStake(v.activated_stake) }))} />
                </div>
            ) : null}
        </section>
    );
};

export default HomeDashboard;
