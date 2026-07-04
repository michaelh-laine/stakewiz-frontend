import React, { FC, useState } from 'react';
import { clusterStatsI, validatorI } from '../validator/interfaces';

export type WizardPreset = 'returns' | 'reliability' | 'decentralize' | 'mev' | 'lowfees' | null;

export const PRESET_DEFINITIONS: Record<Exclude<WizardPreset, null>, {
    title: string;
    icon: string;
    description: string;
    accent: string;
    summary: (validators: validatorI[]) => string;
}> = {
    returns: {
        title: 'Maximize returns',
        icon: 'bi-graph-up-arrow',
        description: 'Highest TrueAPY validators with sensible commission and decent score.',
        accent: 'cyan',
        summary: vs => {
            const eligible = vs.filter(v => !v.delinquent && v.commission <= 10 && v.wiz_score >= 70);
            if (eligible.length === 0) return '';
            const top = [...eligible].sort((a, b) => b.total_apy - a.total_apy)[0];
            return 'Best APY now: ' + top.total_apy + '%';
        }
    },
    reliability: {
        title: 'Most reliable',
        icon: 'bi-shield-check',
        description: 'Validators with low skip rates, high uptime and proven track records.',
        accent: 'emerald',
        summary: vs => vs.filter(v => !v.delinquent && v.skip_rate <= 5 && v.uptime >= 99).length + ' validators meet the bar'
    },
    decentralize: {
        title: 'Help decentralize',
        icon: 'bi-diagram-3-fill',
        description: 'Quality validators with smaller stakes — your delegation has more impact.',
        accent: 'magenta',
        summary: vs => vs.filter(v => !v.delinquent && v.wiz_score >= 80 && v.stake_ratio < 0.025).length + ' under-staked but trusted'
    },
    mev: {
        title: 'Capture MEV',
        icon: 'bi-lightning-charge-fill',
        description: 'Jito-enabled validators with reasonable MEV commission for extra rewards.',
        accent: 'amber',
        summary: vs => vs.filter(v => v.is_jito && v.jito_commission_bps / 100 <= 10).length + ' Jito-enabled'
    },
    lowfees: {
        title: 'Lowest fees',
        icon: 'bi-cash-coin',
        description: 'Trustworthy validators charging minimal commission — more goes to you.',
        accent: 'sky',
        summary: vs => vs.filter(v => !v.delinquent && v.commission <= 5 && v.wiz_score >= 80).length + ' validators under 5% commission'
    }
};

const HomeWizard: FC<{
    validators: validatorI[] | null;
    clusterStats: clusterStatsI | null;
    selectedPreset: WizardPreset;
    onSelectPreset: (preset: WizardPreset) => void;
}> = ({ validators, clusterStats, selectedPreset, onSelectPreset }) => {
    const validatorCount = validators ? validators.length : 0;
    const handlePick = (preset: WizardPreset) => {
        onSelectPreset(preset);
        setTimeout(() => {
            const el = document.getElementById('vlist-search');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    return (
        <section className="sw-wizard">
            <div className="sw-wizard-head">
                <div className="sw-eyebrow">Stakewiz · Guided</div>
                <h1 className="sw-wizard-title">What matters most for your stake?</h1>
                <p className="sw-wizard-sub">
                    Pick a goal and we&rsquo;ll narrow down the {validatorCount.toLocaleString()} Solana validators
                    {clusterStats ? ' (avg APY ' + clusterStats.avg_apy.toFixed(2) + '%)' : ''} to a handful that match.
                    Change your mind any time — the list updates instantly.
                </p>
            </div>
            <div className="sw-wizard-grid">
                {(Object.entries(PRESET_DEFINITIONS) as [Exclude<WizardPreset, null>, typeof PRESET_DEFINITIONS[keyof typeof PRESET_DEFINITIONS]][]).map(([key, def]) => (
                    <button
                        key={key}
                        type="button"
                        className={'sw-wizard-card sw-wizard-' + def.accent + (selectedPreset === key ? ' sw-wizard-card-active' : '')}
                        onClick={() => handlePick(key)}
                    >
                        <div className="sw-wizard-card-icon"><i className={'bi ' + def.icon} /></div>
                        <div className="sw-wizard-card-body">
                            <div className="sw-wizard-card-title">{def.title}</div>
                            <div className="sw-wizard-card-desc">{def.description}</div>
                            {validators ? <div className="sw-wizard-card-stat">{def.summary(validators)}</div> : null}
                        </div>
                        <div className="sw-wizard-card-cta"><i className="bi bi-arrow-right" /></div>
                    </button>
                ))}
            </div>
            <div className="sw-wizard-foot">
                {selectedPreset ? (
                    <button type="button" className="sw-link" onClick={() => onSelectPreset(null)}>
                        <i className="bi bi-x-circle me-1" /> Clear preset, show all validators
                    </button>
                ) : (
                    <span className="sw-wizard-hint">Or just <a href="#vlist-search">browse the full list</a>.</span>
                )}
            </div>
        </section>
    );
};

export default HomeWizard;
