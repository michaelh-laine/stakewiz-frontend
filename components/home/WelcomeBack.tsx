import React, { FC, useMemo } from 'react';
import Link from 'next/link';
import { validatorI } from '../validator/interfaces';

interface WelcomeBackProps {
    userPubkey: string | null;
    walletValidators: string[] | null;
    validators: validatorI[] | null;
}

const shorten = (s: string) => {
    if (!s) return '';
    if (s.length <= 12) return s;
    return s.slice(0, 6) + '…' + s.slice(-4);
};

const WelcomeBack: FC<WelcomeBackProps> = ({ userPubkey, walletValidators, validators }) => {
    const summary = useMemo(() => {
        if (!userPubkey || !walletValidators || !validators) return null;

        const walletSet = new Set(walletValidators);
        const staked = validators.filter(v => walletSet.has(v.vote_identity));
        if (staked.length === 0) return { staked: [], delinquent: 0, avgApy: 0, avgWiz: 0 };

        const totalStakeShare = staked.reduce((acc, v) => acc + (v.activated_stake || 0), 0);
        const weightedApy = staked.reduce((acc, v) => acc + (v.total_apy || 0) * (v.activated_stake || 0), 0)
            / (totalStakeShare || 1);
        const weightedWiz = staked.reduce((acc, v) => acc + (v.wiz_score || 0) * (v.activated_stake || 0), 0)
            / (totalStakeShare || 1);
        const delinquent = staked.filter(v => v.delinquent).length;

        return { staked, delinquent, avgApy: weightedApy, avgWiz: weightedWiz };
    }, [userPubkey, walletValidators, validators]);

    if (!userPubkey) return null;

    if (!summary || summary.staked.length === 0) {
        return (
            <div className="sw-welcome sw-welcome-empty" role="status">
                <div className="sw-welcome-inner">
                    <div className="sw-welcome-icon"><i className="bi bi-wallet2" /></div>
                    <div className="sw-welcome-copy">
                        <div className="sw-welcome-title">Wallet connected</div>
                        <div className="sw-welcome-sub">
                            <span className="sw-mono">{shorten(userPubkey)}</span> · No stakes found yet — pick a validator below to get started.
                        </div>
                    </div>
                    <Link href="/stakes" passHref legacyBehavior>
                        <a className="btn sw-btn-ghost sw-welcome-cta">Open My Stakes</a>
                    </Link>
                </div>
            </div>
        );
    }

    const statusIcon = summary.delinquent > 0 ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
    const statusClass = summary.delinquent > 0 ? 'sw-welcome-warn' : 'sw-welcome-ok';

    return (
        <div className={'sw-welcome ' + statusClass} role="status">
            <div className="sw-welcome-inner">
                <div className="sw-welcome-icon"><i className={'bi ' + statusIcon} /></div>
                <div className="sw-welcome-copy">
                    <div className="sw-welcome-title">
                        Welcome back{summary.delinquent > 0 ? ' — heads up' : ''}
                    </div>
                    <div className="sw-welcome-sub">
                        You have <strong>{summary.staked.length}</strong> stake{summary.staked.length === 1 ? '' : 's'}
                        {' '}earning a weighted <strong>{summary.avgApy.toFixed(2)}%</strong> APY
                        {' '}across validators averaging Wiz <strong>{summary.avgWiz.toFixed(0)}%</strong>.
                        {summary.delinquent > 0 ? (
                            <span className="sw-welcome-warn-line">
                                {' '}<strong>{summary.delinquent}</strong> currently delinquent — review below.
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="sw-welcome-actions">
                    <Link href="/stakes" passHref legacyBehavior>
                        <a className="btn sw-btn-primary sw-welcome-cta">My stakes</a>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default WelcomeBack;
