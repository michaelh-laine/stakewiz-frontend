import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { validatorI } from './validator/interfaces';
import config from '../config.json';

interface SearchProps {
    validators: validatorI[];
    setFilter: (filtered: validatorI[]) => void;
    walletValidators: string[] | null;
    stakeValidators: validatorI[] | null;
    showMultiStakeModal: boolean;
    updateMultiStakeModal: (show: boolean) => void;
    showListView: boolean;
    updateListView: (show: boolean) => void;
    preset?: 'returns' | 'reliability' | 'decentralize' | 'mev' | 'lowfees' | null;
}

type SortKey =
    | 'rank' | 'rank_asc'
    | 'activated_stake' | 'activated_stake_asc'
    | 'total_apy' | 'total_apy_asc'
    | 'commission' | 'commission_asc'
    | 'skip_rate' | 'skip_rate_asc'
    | 'credit_ratio' | 'credit_ratio_asc'
    | 'uptime' | 'uptime_asc'
    | 'first_epoch_with_stake' | 'first_epoch_with_stake_asc'
    | 'asncity_concentration' | 'asncity_concentration_asc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'rank_asc', label: 'Wiz Score (best first)' },
    { value: 'rank', label: 'Wiz Score (worst first)' },
    { value: 'total_apy', label: 'TrueAPY (high → low)' },
    { value: 'total_apy_asc', label: 'TrueAPY (low → high)' },
    { value: 'commission_asc', label: 'Commission (low → high)' },
    { value: 'commission', label: 'Commission (high → low)' },
    { value: 'activated_stake_asc', label: 'Stake (low → high)' },
    { value: 'activated_stake', label: 'Stake (high → low)' },
    { value: 'skip_rate_asc', label: 'Skip rate (low → high)' },
    { value: 'uptime', label: '30d uptime (high → low)' },
    { value: 'first_epoch_with_stake', label: 'Epochs active (new → old)' },
    { value: 'first_epoch_with_stake_asc', label: 'Epochs active (old → new)' },
    { value: 'asncity_concentration_asc', label: 'ASN+City concentration (low → high)' }
];

interface FilterState {
    text: string;
    hideAnonymous: boolean;
    onlyMine: boolean;
    hideHighStake: boolean;
    onlyJito: boolean;
    hideDelinquent: boolean;
    minWizScore: number;
    minApy: number;
    maxCommission: number;
    maxSkipRate: number;
    sortField: SortKey;
}

const DEFAULT_FILTERS: FilterState = {
    text: '', hideAnonymous: false, onlyMine: false, hideHighStake: false, onlyJito: false,
    hideDelinquent: true, minWizScore: 0, minApy: 0, maxCommission: 100, maxSkipRate: 100, sortField: 'rank_asc'
};

interface QuickFilter {
    id: string;
    label: string;
    icon: string;
    hint: string;
    apply: (f: FilterState) => FilterState;
    isActive: (f: FilterState) => boolean;
    /** Keys of FilterState this preset directly controls (used to hide duplicated pills). */
    ownsKeys: (keyof FilterState)[];
}

const QUICK_FILTERS: QuickFilter[] = [
    { id: 'top-picks', label: 'Top picks', icon: 'bi-stars',
      hint: 'Top-scoring validators — 90%+ Wiz, hides high-stake and unnamed',
      apply: f => ({ ...f, minWizScore: 90, hideDelinquent: true, hideHighStake: true, hideAnonymous: true }),
      isActive: f => f.minWizScore >= 90 && f.hideHighStake && f.hideAnonymous,
      ownsKeys: ['minWizScore', 'hideHighStake', 'hideAnonymous', 'hideDelinquent'] },
    { id: 'high-apy', label: 'High APY', icon: 'bi-graph-up-arrow',
      hint: 'APY ≥ 7% and commission ≤ 10%, sorted by yield',
      apply: f => ({ ...f, minApy: 7, sortField: 'total_apy', maxCommission: 10 }),
      isActive: f => f.minApy >= 7 && f.maxCommission <= 10,
      ownsKeys: ['minApy', 'maxCommission'] },
    { id: 'low-commission', label: 'Low commission', icon: 'bi-cash-coin',
      hint: 'Commission ≤ 5%, sorted low → high',
      apply: f => ({ ...f, maxCommission: 5, sortField: 'commission_asc' }),
      isActive: f => f.maxCommission <= 5 && f.minApy === 0,
      ownsKeys: ['maxCommission'] },
    { id: 'jito', label: 'Jito MEV', icon: 'bi-lightning-charge-fill',
      hint: 'Only Jito-enabled validators (extra MEV rewards)',
      apply: f => ({ ...f, onlyJito: !f.onlyJito }),
      isActive: f => f.onlyJito,
      ownsKeys: ['onlyJito'] },
    { id: 'decentralize', label: 'Decentralize', icon: 'bi-diagram-3-fill',
      hint: 'Trusted (Wiz ≥ 80%) validators with smaller stake — bigger impact',
      apply: f => ({ ...f, hideHighStake: true, minWizScore: 80, sortField: 'activated_stake_asc' }),
      isActive: f => f.hideHighStake && f.minWizScore >= 80 && f.minWizScore < 90,
      ownsKeys: ['minWizScore', 'hideHighStake'] },
    { id: 'reliable', label: 'Most reliable', icon: 'bi-shield-check',
      hint: 'Skip rate ≤ 5% and no delinquents, sorted by uptime',
      apply: f => ({ ...f, maxSkipRate: 5, sortField: 'uptime', hideDelinquent: true }),
      isActive: f => f.maxSkipRate <= 5 && f.hideDelinquent,
      ownsKeys: ['maxSkipRate', 'hideDelinquent'] }
];

const PRESET_FILTERS: Record<NonNullable<SearchProps['preset']>, Partial<FilterState>> = {
    returns: { minWizScore: 70, maxCommission: 10, minApy: 6, sortField: 'total_apy', hideDelinquent: true, hideAnonymous: true },
    reliability: { maxSkipRate: 5, hideDelinquent: true, sortField: 'uptime', hideAnonymous: true },
    decentralize: { minWizScore: 80, hideHighStake: true, maxCommission: 10, sortField: 'activated_stake_asc', hideDelinquent: true, hideAnonymous: true },
    mev: { onlyJito: true, maxCommission: 10, sortField: 'total_apy', hideDelinquent: true, hideAnonymous: true },
    lowfees: { maxCommission: 5, minWizScore: 80, sortField: 'commission_asc', hideDelinquent: true, hideAnonymous: true }
};

const RangeRow: FC<{ label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }> = ({ label, value, min, max, step, unit, onChange }) => (
    <div className="sw-slider-row">
        <div className="sw-slider-label"><span>{label}</span><strong>{value}{unit}</strong></div>
        <input type="range" className="form-range sw-range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
);

const SearchBar: FC<SearchProps> = ({ validators, setFilter, walletValidators, stakeValidators, updateMultiStakeModal, showListView, updateListView, preset }) => {
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

    const lastPresetRef = useRef<typeof preset>(undefined);
    useEffect(() => {
        if (preset !== lastPresetRef.current) {
            lastPresetRef.current = preset;
            setFilters(prev => preset
                ? { ...DEFAULT_FILTERS, text: prev.text, ...PRESET_FILTERS[preset] }
                : { ...DEFAULT_FILTERS, text: prev.text }
            );
        }
    }, [preset]);

    const filtered = useMemo(() => {
        if (!validators) return [];
        const q = filters.text.trim().toUpperCase();
        const result = validators.filter(v => {
            if (q.length > 0) {
                const haystack = (v.name + v.identity + v.vote_identity).toUpperCase();
                if (haystack.indexOf(q) === -1) return false;
            }
            if (filters.hideAnonymous && (!v.name || v.name === '')) return false;
            if (filters.hideDelinquent && v.delinquent) return false;
            if (filters.hideHighStake && v.stake_ratio >= config.STAKE_CATEGORIES.HIGH) return false;
            if (filters.onlyJito && !v.is_jito) return false;
            if (filters.onlyMine && walletValidators && !walletValidators.includes(v.vote_identity)) return false;
            if (v.wiz_score < filters.minWizScore) return false;
            if (v.total_apy < filters.minApy) return false;
            if (v.commission > filters.maxCommission) return false;
            if (v.skip_rate > filters.maxSkipRate) return false;
            return true;
        });
        const sf = filters.sortField;
        if (sf.endsWith('_asc')) {
            const key = sf.substring(0, sf.length - 4) as keyof validatorI;
            result.sort((a, b) => (a[key] as number) > (b[key] as number) ? 1 : (a[key] as number) < (b[key] as number) ? -1 : 0);
        } else {
            const key = sf as keyof validatorI;
            result.sort((a, b) => (a[key] as number) < (b[key] as number) ? 1 : (a[key] as number) > (b[key] as number) ? -1 : 0);
        }
        return result;
    }, [validators, filters, walletValidators]);

    const setFilterRef = useRef(setFilter);
    setFilterRef.current = setFilter;
    useEffect(() => { setFilterRef.current(filtered); }, [filtered]);

    const update = (patch: Partial<FilterState>) => setFilters(f => ({ ...f, ...patch }));

    const onlyMineDisabled = !walletValidators || walletValidators.length < 1;
    const onlyMineTooltip = !walletValidators
        ? 'Connect your wallet to filter for validators you have stakes with.'
        : walletValidators.length < 1
            ? "You don't have any stakes on this wallet."
            : 'Only show validators with which you have stakes.';

    const selectCount = stakeValidators ? stakeValidators.length : 0;

    const hasActiveFilters = filters.hideAnonymous || filters.onlyMine || filters.hideHighStake || filters.onlyJito
        || filters.hideDelinquent !== DEFAULT_FILTERS.hideDelinquent
        || filters.minWizScore > 0 || filters.minApy > 0
        || filters.maxCommission < 100 || filters.maxSkipRate < 100;

    const clearAll = () => setFilters({ ...DEFAULT_FILTERS, text: filters.text });

    const activeQuick = QUICK_FILTERS.filter(qf => qf.isActive(filters));
    const ownedByActive = new Set<keyof FilterState>();
    activeQuick.forEach(qf => qf.ownsKeys.forEach(k => ownedByActive.add(k)));

    const activePills: { key: string; label: string; clear: () => void; kind?: 'preset' | 'filter' }[] = [];
    activeQuick.forEach(qf => activePills.push({
        key: 'preset:' + qf.id,
        label: qf.label + ' preset',
        kind: 'preset',
        clear: () => setFilters(prev => ({ ...DEFAULT_FILTERS, text: prev.text }))
    }));

    if (filters.hideAnonymous && !ownedByActive.has('hideAnonymous')) activePills.push({ key: 'anon', label: 'Hide unnamed', clear: () => update({ hideAnonymous: false }) });
    if (filters.onlyMine && !ownedByActive.has('onlyMine')) activePills.push({ key: 'mine', label: 'Only my stakes', clear: () => update({ onlyMine: false }) });
    if (filters.hideHighStake && !ownedByActive.has('hideHighStake')) activePills.push({ key: 'hs', label: 'Hide high-stake', clear: () => update({ hideHighStake: false }) });
    if (filters.onlyJito && !ownedByActive.has('onlyJito')) activePills.push({ key: 'jito', label: 'Only Jito MEV', clear: () => update({ onlyJito: false }) });
    if (!filters.hideDelinquent && !ownedByActive.has('hideDelinquent')) activePills.push({ key: 'del', label: 'Showing delinquent', clear: () => update({ hideDelinquent: true }) });
    if (filters.minWizScore > 0 && !ownedByActive.has('minWizScore')) activePills.push({ key: 'wiz', label: 'Wiz ≥ ' + filters.minWizScore + '%', clear: () => update({ minWizScore: 0 }) });
    if (filters.minApy > 0 && !ownedByActive.has('minApy')) activePills.push({ key: 'apy', label: 'APY ≥ ' + filters.minApy + '%', clear: () => update({ minApy: 0 }) });
    if (filters.maxCommission < 100 && !ownedByActive.has('maxCommission')) activePills.push({ key: 'comm', label: 'Commission ≤ ' + filters.maxCommission + '%', clear: () => update({ maxCommission: 100 }) });
    if (filters.maxSkipRate < 100 && !ownedByActive.has('maxSkipRate')) activePills.push({ key: 'skip', label: 'Skip ≤ ' + filters.maxSkipRate + '%', clear: () => update({ maxSkipRate: 100 }) });

    return (
        <div className="sw-search-shell" id="vlist-search">
            <div className="sw-search-row">
                <div className="sw-search-input">
                    <i className="bi bi-search sw-search-icon" />
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search by name, identity or vote account…"
                        value={filters.text}
                        autoComplete="off"
                        onChange={e => update({ text: e.target.value })}
                        onKeyDown={e => { if (e.code === 'Escape') update({ text: '' }); }}
                    />
                    {filters.text ? (
                        <button type="button" className="sw-search-clear" onClick={() => update({ text: '' })} aria-label="Clear search">
                            <i className="bi bi-x-lg" />
                        </button>
                    ) : null}
                </div>
                <div className="sw-search-meta">
                    <div className="sw-result-count">
                        <strong>{filtered.length}</strong><span>validators</span>
                    </div>
                    <OverlayTrigger placement="top" overlay={<Tooltip>{showListView ? 'Card view' : 'List view'}</Tooltip>}>
                        <button type="button" className="sw-icon-btn" onClick={() => updateListView(!showListView)}>
                            <i className={'bi ' + (showListView ? 'bi-grid-3x3-gap' : 'bi-list-ul')} />
                        </button>
                    </OverlayTrigger>
                    <OverlayTrigger placement="top" overlay={<Tooltip>{advancedOpen ? 'Hide advanced filters' : 'Show advanced filters'}</Tooltip>}>
                        <button type="button" className={'sw-icon-btn' + (advancedOpen ? ' sw-icon-btn-active' : '')} onClick={() => setAdvancedOpen(o => !o)}>
                            <i className="bi bi-sliders" />
                        </button>
                    </OverlayTrigger>
                </div>
            </div>

            <div className="sw-chip-row">
                {QUICK_FILTERS.map(qf => {
                    const active = qf.isActive(filters);
                    return (
                        <OverlayTrigger key={qf.id} placement="top" overlay={<Tooltip>{qf.hint}</Tooltip>}>
                            <button type="button" className={'sw-chip' + (active ? ' sw-chip-active' : '')} onClick={() => setFilters(prev => qf.apply(prev))}>
                                <i className={'bi ' + qf.icon + ' me-1'} /> {qf.label}
                            </button>
                        </OverlayTrigger>
                    );
                })}
                <span className="sw-chip-divider" aria-hidden="true" />
                <label className={'sw-chip sw-chip-toggle' + (filters.hideAnonymous ? ' sw-chip-active' : '')}>
                    <input type="checkbox" checked={filters.hideAnonymous} onChange={e => update({ hideAnonymous: e.target.checked })} />
                    <i className="bi bi-incognito me-1" /> Hide unnamed
                </label>
                <OverlayTrigger placement="top" overlay={<Tooltip>{onlyMineTooltip}</Tooltip>}>
                    <label className={'sw-chip sw-chip-toggle' + (filters.onlyMine ? ' sw-chip-active' : '') + (onlyMineDisabled ? ' sw-chip-disabled' : '')}>
                        <input type="checkbox" checked={filters.onlyMine} disabled={onlyMineDisabled} onChange={e => update({ onlyMine: e.target.checked })} />
                        <i className="bi bi-wallet2 me-1" /> Only mine
                    </label>
                </OverlayTrigger>
                <label className={'sw-chip sw-chip-toggle' + (filters.hideHighStake ? ' sw-chip-active' : '')}>
                    <input type="checkbox" checked={filters.hideHighStake} onChange={e => update({ hideHighStake: e.target.checked })} />
                    <i className="bi bi-funnel me-1" /> Hide high-stake
                </label>
                <div className="sw-chip-spacer" />
                <div className="sw-sort">
                    <label className="sw-sort-label" htmlFor="sw-sort-select">Sort</label>
                    <select id="sw-sort-select" className="form-select form-select-sm sw-sort-select" value={filters.sortField} onChange={e => update({ sortField: e.target.value as SortKey })}>
                        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <button type="button" className="sw-chip sw-chip-stake" onClick={() => updateMultiStakeModal(true)} disabled={selectCount === 0}>
                    <i className={'bi ' + (selectCount === 0 ? 'bi-minecart' : 'bi-minecart-loaded') + ' me-1'} />
                    {selectCount} selected
                </button>
            </div>

            {advancedOpen ? (
                <div className="sw-advanced">
                    <div className="sw-slider-grid">
                        <RangeRow label="Minimum Wiz Score" value={filters.minWizScore} min={0} max={100} step={1} unit="%" onChange={v => update({ minWizScore: v })} />
                        <RangeRow label="Minimum APY" value={filters.minApy} min={0} max={12} step={0.1} unit="%" onChange={v => update({ minApy: v })} />
                        <RangeRow label="Maximum commission" value={filters.maxCommission} min={0} max={100} step={1} unit="%" onChange={v => update({ maxCommission: v })} />
                        <RangeRow label="Maximum skip rate" value={filters.maxSkipRate} min={0} max={100} step={0.5} unit="%" onChange={v => update({ maxSkipRate: v })} />
                    </div>
                    <div className="sw-advanced-extras">
                        <label className="form-check form-switch">
                            <input type="checkbox" className="form-check-input" checked={!filters.hideDelinquent} onChange={e => update({ hideDelinquent: !e.target.checked })} />
                            <span className="ms-2">Show delinquent validators</span>
                        </label>
                    </div>
                </div>
            ) : null}

            {(activePills.length > 0 || hasActiveFilters) ? (
                <div className="sw-active-filters">
                    <span className="sw-active-label">Active filters:</span>
                    {activePills.map(p => (
                        <button key={p.key} type="button" className={'sw-active-pill' + (p.kind === 'preset' ? ' sw-active-pill-preset' : '')} onClick={p.clear}>
                            {p.label}<i className="bi bi-x ms-1" />
                        </button>
                    ))}
                    <button type="button" className="sw-active-clear" onClick={clearAll}>
                        <i className="bi bi-arrow-counterclockwise me-1" /> Clear all
                    </button>
                </div>
            ) : null}
        </div>
    );
};

export default SearchBar;
