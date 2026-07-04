import React, { FC, useMemo } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { validatorI } from '../validator/interfaces';
import { getStakeStatus, StakeStatus } from './common';

interface StakesSummaryProps {
    stakes: any[] | null;
    validatorList: validatorI[] | null;
    epoch: number;
    walletPubkey: string;
    connected: boolean;
    onDisconnect: () => void;
}

const formatSol = (sol: number, digits = 2): string => {
    if (!sol) return '0';
    if (sol >= 1_000_000) return (sol / 1_000_000).toFixed(2) + 'M';
    if (sol >= 1_000) return (sol / 1_000).toFixed(1) + 'K';
    return sol.toFixed(digits);
};

const truncate = (s: string, n = 10) => {
    if (!s || s.length <= n * 2 + 3) return s;
    return s.slice(0, n) + '…' + s.slice(-4);
};

const Kpi: FC<{ label: string; value: string; sub?: string; kind?: string }> = ({ label, value, sub, kind }) => (
    <div className={'sw-stakes-kpi ' + (kind ? 'sw-stakes-kpi-' + kind : '')}>
        <div className="sw-stat-label">{label}</div>
        <div className="sw-stat-value">{value}</div>
        {sub ? <div className="sw-stat-sub">{sub}</div> : null}
    </div>
);

const StakesSummary: FC<StakesSummaryProps> = ({ stakes, validatorList, epoch, walletPubkey, connected, onDisconnect }) => {
    const summary = useMemo(() => {
        if (!stakes || stakes.length === 0) return null;

        let totalLamports = 0;
        let activeLamports = 0;
        let activatingLamports = 0;
        let deactivatingLamports = 0;
        let inactiveLamports = 0;
        let activeCount = 0;
        let activatingCount = 0;
        let deactivatingCount = 0;
        let inactiveCount = 0;
        const validatorSet = new Set<string>();

        const validatorMap = new Map<string, validatorI>();
        if (validatorList) {
            validatorList.forEach(v => validatorMap.set(v.vote_identity, v));
        }

        let weightedApyNum = 0;
        let weightedApyDen = 0;
        let weightedCommNum = 0;
        let weightedCommDen = 0;
        let weightedWizNum = 0;
        let weightedWizDen = 0;
        let jitoLamports = 0;

        stakes.forEach((stake: any) => {
            const lamports = stake.account.lamports || 0;
            totalLamports += lamports;

            const status = getStakeStatus(stake, epoch);
            switch (status) {
                case StakeStatus.Active: activeCount++; activeLamports += lamports; break;
                case StakeStatus.Activating: activatingCount++; activatingLamports += lamports; break;
                case StakeStatus.Deactivating: deactivatingCount++; deactivatingLamports += lamports; break;
                case StakeStatus.Inactive: inactiveCount++; inactiveLamports += lamports; break;
                default: break;
            }

            const voter = stake.account?.data?.parsed?.info?.stake?.delegation?.voter;
            if (voter) {
                validatorSet.add(voter);
                const v = validatorMap.get(voter);
                if (v) {
                    weightedApyNum += (v.total_apy || 0) * lamports;
                    weightedApyDen += lamports;
                    weightedCommNum += (v.commission || 0) * lamports;
                    weightedCommDen += lamports;
                    weightedWizNum += (v.wiz_score || 0) * lamports;
                    weightedWizDen += lamports;
                    if (v.is_jito) jitoLamports += lamports;
                }
            }
        });

        const totalSol = totalLamports / LAMPORTS_PER_SOL;
        const activeSol = activeLamports / LAMPORTS_PER_SOL;
        const activatingSol = activatingLamports / LAMPORTS_PER_SOL;
        const deactivatingSol = deactivatingLamports / LAMPORTS_PER_SOL;
        const inactiveSol = inactiveLamports / LAMPORTS_PER_SOL;
        const jitoSol = jitoLamports / LAMPORTS_PER_SOL;

        const weightedApy = weightedApyDen > 0 ? weightedApyNum / weightedApyDen : 0;
        const weightedComm = weightedCommDen > 0 ? weightedCommNum / weightedCommDen : 0;
        const weightedWiz = weightedWizDen > 0 ? weightedWizNum / weightedWizDen : 0;

        const projectedAnnualYield = activeSol * (weightedApy / 100);

        return {
            totalSol, activeSol, activatingSol, deactivatingSol, inactiveSol,
            totalLamports, activeLamports, activatingLamports, deactivatingLamports, inactiveLamports,
            activeCount, activatingCount, deactivatingCount, inactiveCount,
            stakeCount: stakes.length,
            validatorCount: validatorSet.size,
            weightedApy, weightedComm, weightedWiz,
            projectedAnnualYield,
            jitoSol,
            jitoPct: totalSol > 0 ? (jitoSol / totalSol) * 100 : 0
        };
    }, [stakes, validatorList, epoch]);

    if (!summary) return null;

    const bars = {
        active: summary.totalLamports > 0 ? (summary.activeLamports / summary.totalLamports) * 100 : 0,
        activating: summary.totalLamports > 0 ? (summary.activatingLamports / summary.totalLamports) * 100 : 0,
        deactivating: summary.totalLamports > 0 ? (summary.deactivatingLamports / summary.totalLamports) * 100 : 0,
        inactive: summary.totalLamports > 0 ? (summary.inactiveLamports / summary.totalLamports) * 100 : 0
    };

    return (
        <section className="sw-stakes-summary">
            <div className="sw-stakes-hero">
                <div>
                    <div className="sw-eyebrow">
                        {connected ? 'Connected wallet' : 'Viewing wallet'}
                    </div>
                    <h1 className="sw-stakes-hero-title">Your staking portfolio</h1>
                    <p className="sw-stakes-hero-sub">
                        {summary.stakeCount} stake account{summary.stakeCount === 1 ? '' : 's'} across {summary.validatorCount} validator{summary.validatorCount === 1 ? '' : 's'} · epoch {epoch}
                    </p>
                </div>
                <div className="sw-stakes-wallet">
                    <i className="bi bi-wallet2" />
                    <span>{truncate(walletPubkey, 6)}</span>
                    <button
                        type="button"
                        className="sw-active-clear"
                        style={{ marginLeft: '0.6rem', textDecoration: 'none' }}
                        onClick={onDisconnect}
                        title={connected ? 'Disconnect wallet' : 'Close view'}
                    >
                        <i className="bi bi-x-lg" />
                    </button>
                </div>
            </div>

            <div className="sw-stakes-grid">
                <Kpi
                    kind="total"
                    label="Total staked"
                    value={'◎ ' + formatSol(summary.totalSol)}
                    sub={summary.stakeCount + ' account' + (summary.stakeCount === 1 ? '' : 's')}
                />
                <Kpi
                    kind="active"
                    label="Active"
                    value={'◎ ' + formatSol(summary.activeSol)}
                    sub={summary.activeCount + ' active · earning yield'}
                />
                <Kpi
                    kind="apy"
                    label="Weighted APY"
                    value={summary.weightedApy.toFixed(2) + '%'}
                    sub={'≈ ◎ ' + formatSol(summary.projectedAnnualYield) + ' / year'}
                />
                <Kpi
                    kind="commission"
                    label="Weighted commission"
                    value={summary.weightedComm.toFixed(2) + '%'}
                    sub={'Weighted Wiz Score ' + summary.weightedWiz.toFixed(0) + '%'}
                />
                {summary.activatingSol > 0 ? (
                    <Kpi
                        kind="activating"
                        label="Activating"
                        value={'◎ ' + formatSol(summary.activatingSol)}
                        sub={summary.activatingCount + ' warming up next epoch'}
                    />
                ) : null}
                {summary.deactivatingSol > 0 ? (
                    <Kpi
                        kind="activating"
                        label="Deactivating"
                        value={'◎ ' + formatSol(summary.deactivatingSol)}
                        sub={summary.deactivatingCount + ' unstaking'}
                    />
                ) : null}
                {summary.inactiveSol > 0 ? (
                    <Kpi
                        kind="inactive"
                        label="Inactive"
                        value={'◎ ' + formatSol(summary.inactiveSol)}
                        sub={summary.inactiveCount + ' ready to withdraw'}
                    />
                ) : null}
                {summary.jitoSol > 0 ? (
                    <Kpi
                        label="Jito MEV exposure"
                        value={'◎ ' + formatSol(summary.jitoSol)}
                        sub={summary.jitoPct.toFixed(0) + '% of portfolio'}
                    />
                ) : null}
            </div>

            <div className="sw-stakes-status-bar" aria-label="Portfolio breakdown">
                {bars.active > 0 ? <div className="sw-stakes-status-active" style={{ width: bars.active + '%' }} /> : null}
                {bars.activating > 0 ? <div className="sw-stakes-status-activating" style={{ width: bars.activating + '%' }} /> : null}
                {bars.deactivating > 0 ? <div className="sw-stakes-status-deactivating" style={{ width: bars.deactivating + '%' }} /> : null}
                {bars.inactive > 0 ? <div className="sw-stakes-status-inactive" style={{ width: bars.inactive + '%' }} /> : null}
            </div>
            <div className="sw-stakes-status-legend">
                <span><i className="sw-stakes-status-active" /> Active {bars.active.toFixed(0)}%</span>
                {summary.activatingSol > 0 ? <span><i className="sw-stakes-status-activating" /> Activating {bars.activating.toFixed(0)}%</span> : null}
                {summary.deactivatingSol > 0 ? <span><i className="sw-stakes-status-deactivating" /> Deactivating {bars.deactivating.toFixed(0)}%</span> : null}
                {summary.inactiveSol > 0 ? <span><i className="sw-stakes-status-inactive" /> Inactive {bars.inactive.toFixed(0)}%</span> : null}
            </div>
        </section>
    );
};

export default StakesSummary;
