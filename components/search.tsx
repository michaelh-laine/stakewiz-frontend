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
    preset?: GoalId | null;
}

type GoalId = 'returns' | 'reliability' | 'decentralize' | 'mev' | 'lowfees' | 'mine';

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

const SORT_LABELS: Record<SortKey, string> = {
    rank_asc: 'Wiz Score (best first)',
    rank: 'Wiz Score (worst first)',
    total_apy: 'TrueAPY (high → low)',
    total_apy_asc: 'TrueAPY (low → high)',
    commission_asc: 'Commission (low → high)',
    commission: 'Commission (high → low)',
    activated_stake_asc: 'Stake (low → high)',
    activated_stake: 'Stake (high → low)',
    skip_rate_asc: 'Skip rate (low → high)',
    skip_rate: 'Skip rate (high → low)',
    credit_ratio: 'Vote rate (high → low)',
    credit_ratio_asc: 'Vote rate (low → high)',
    uptime: '30d uptime (high → low)',
    uptime_asc: '30d uptime (low → high)',
    first_epoch_with_stake: 'Epochs active (new → old)',
    first_epoch_with_stake_asc: 'Epochs active (old → new)',
    asncity_concentration_asc: 'ASN+City concentration (low → high)',
    asncity_concentration: 'ASN+City concentration (high → low)'
};

interface FilterState {
    text: string;
    goal: GoalId | null;
    minWizScore: number;
    minApy: number;
    maxCommission: number;
    maxSkipRate: number;
    hideAnonymous: boolean;
    hideHighStake: boolean;
    hideDelinquent: boolean;
    onlyJito: boolean;
    onlyMine: boolean;
    sortField: SortKey;
    /** True when sort is following the active goal; false when user overrode. */
    sortAuto: boolean;
}

const DEFAULT_FILTERS: FilterState = {
    text: '', goal: null,
    minWizScore: 0, minApy: 0, maxCommission: 100, maxSkipRate: 100,
    hideAnonymous: false, hideHighStake: false, hideDelinquent: true,
    onlyJito: false, onlyMine: false,
    sortField: 'rank_asc', sortAuto: true
};

interface Goal {
    id: GoalId;
    label: string;
    icon: string;
    hint: string;
    /** Filter tweaks applied on top of DEFAULT_FILTERS. */
    filters: Partial<FilterState>;
    /** Sort that ships with this goal. */
    sort: SortKey;
    /** Which FilterState keys this goal owns (used for de-duplicating active pills). */
    owns: (keyof FilterState)[];
    /** Whether this goal needs a connected wallet + wallet validators to work. */
    requiresWallet?: boolean;
}

const GOALS: Goal[] = [
    { id: 'returns', label: 'Best returns', icon: 'bi-graph-up-arrow',
      hint: 'High TrueAPY validators with sensible commission and Wiz Score.',
      filters: { minWizScore: 70, maxCommission: 10, minApy: 6, hideAnonymous: true, hideDelinquent: true },
      sort: 'total_apy',
      owns: ['minWizScore', 'maxCommission', 'minApy', 'hideAnonymous', 'hideDelinquent'] },
    { id: 'reliability', label: 'Most reliable', icon: 'bi-shield-check',
      hint: 'Low skip rate, high uptime, no delinquent history.',
      filters: { maxSkipRate: 5, hideDelinquent: true, hideAnonymous: true, minWizScore: 70 },
      sort: 'uptime',
      owns: ['maxSkipRate', 'hideDelinquent', 'hideAnonymous', 'minWizScore'] },
    { id: 'decentralize', label: 'Decentralize', icon: 'bi-diagram-3-fill',
      hint: 'Trusted validators with smaller stake — help spread the network.',
      filters: { minWizScore: 80, hideHighStake: true, maxCommission: 10, hideAnonymous: true, hideDelinquent: true },
      sort: 'activated_stake_asc',
      owns: ['minWizScore', 'hideHighStake', 'maxCommission', 'hideAnonymous', 'hideDelinquent'] },
    { id: 'mev', label: 'Jito MEV', icon: 'bi-lightning-charge-fill',
      hint: 'Jito-enabled validators for MEV rewards, with commission ≤ 10%.',
      filters: { onlyJito: true, maxCommission: 10, hideDelinquent: true, hideAnonymous: true },
      sort: 'total_apy',
      owns: ['onlyJito', 'maxCommission', 'hideDelinquent', 'hideAnonymous'] },
    { id: 'lowfees', label: 'Lowest fees', icon: 'bi-cash-coin',
      hint: 'Trustworthy validators charging ≤ 5% commission.',
      filters: { maxCommission: 5, minWizScore: 80, hideAnonymous: true, hideDelinquent: true },
      sort: 'commission_asc',
      owns: ['maxCommission', 'minWizScore', 'hideAnonymous', 'hideDelinquent'] },
    { id: 'mine', label: 'My stakes', icon: 'bi-wallet2',
      hint: 'Show only validators you already have stakes with.',
      filters: { onlyMine: true, hideDelinquent: false },
      sort: 'rank_asc',
      owns: ['onlyMine', 'hideDelinquent'],
      requiresWallet: true }
];

const GOAL_BY_ID: Record<GoalId, Goal> = GOALS.reduce((acc, g) => ({ ...acc, [g.id]: g }), {} as Record<GoalId, Goal>);

// --- URL state helpers (shareable / bookmarkable filter state) ---

const readUrlState = (): Partial<FilterState> => {
    if (typeof window === 'undefined') return {};
    const p = new URLSearchParams(window.location.search);
    const out: Partial<FilterState> = {};
    const q = p.get('q'); if (q) out.text = q;
    const goal = p.get('goal') as GoalId | null;
    if (goal && GOAL_BY_ID[goal]) out.goal = goal;
    const sort = p.get('sort') as SortKey | null;
    if (sort && SORT_LABELS[sort]) { out.sortField = sort; out.sortAuto = false; }
    return out;
};

const writeUrlState = (f: FilterState) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (f.text) url.searchParams.set('q', f.text); else url.searchParams.delete('q');
    if (f.goal) url.searchParams.set('goal', f.goal); else url.searchParams.delete('goal');
    if (!f.sortAuto) url.searchParams.set('sort', f.sortField); else url.searchParams.delete('sort');
    window.history.replaceState({}, '', url.toString());
};

const RangeRow: FC<{ label: string; value: number; min: number; max: number; step: number; unit: string; kind: 'min' | 'max'; onChange: (v: number) => void }> = ({ label, value, min, max, step, unit, kind, onChange }) => (
    <div className="sw-slider-row">
        <div className="sw-slider-label">
            <span>{label}</span>
            <strong>{kind === 'min' ? '≥ ' : '≤ '}{value}{unit}</strong>
        </div>
        <input type="range" className="form-range sw-range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
);

const SearchBar: FC<SearchProps> = ({
    validators, setFilter, walletValidators, stakeValidators,
    updateMultiStakeModal, showListView, updateListView, preset
}) => {
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [textOpen, setTextOpen] = useState<boolean>(false);
    const [refineOpen, setRefineOpen] = useState<boolean>(false);
    const textInputRef = useRef<HTMLInputElement>(null);

    // Hydrate from URL on mount
    const hydratedRef = useRef(false);
    useEffect(() => {
        if (hydratedRef.current) return;
        hydratedRef.current = true;
        const patch = readUrlState();
        if (patch.goal) {
            const g = GOAL_BY_ID[patch.goal];
            setFilters(f => ({ ...DEFAULT_FILTERS, ...g.filters, sortField: g.sort, goal: g.id, sortAuto: true, ...patch }));
        } else if (Object.keys(patch).length > 0) {
            setFilters(f => ({ ...DEFAULT_FILTERS, ...patch }));
        }
        if (patch.text) setTextOpen(true);
    }, []);

    // Guided-variant preset takes precedence (external control)
    const lastPresetRef = useRef<GoalId | null | undefined>(undefined);
    useEffect(() => {
        if (preset !== lastPresetRef.current) {
            lastPresetRef.current = preset ?? null;
            if (preset && GOAL_BY_ID[preset]) {
                const g = GOAL_BY_ID[preset];
                setFilters(f => ({ ...DEFAULT_FILTERS, text: f.text, ...g.filters, sortField: g.sort, goal: g.id, sortAuto: true }));
            }
        }
    }, [preset]);

    // Persist to URL as filters change
    useEffect(() => { writeUrlState(filters); }, [filters.text, filters.goal, filters.sortField, filters.sortAuto]);

    // Focus the text input when it opens
    useEffect(() => {
        if (textOpen && textInputRef.current) textInputRef.current.focus();
    }, [textOpen]);

    const applyGoal = (id: GoalId) => {
        if (filters.goal === id) {
            setFilters(f => ({ ...DEFAULT_FILTERS, text: f.text }));
            return;
        }
        const g = GOAL_BY_ID[id];
        setFilters(f => ({ ...DEFAULT_FILTERS, text: f.text, ...g.filters, sortField: g.sort, goal: g.id, sortAuto: true }));
    };

    // Mutating a filter that a goal owns detaches the goal
    const update = (patch: Partial<FilterState>) => {
        setFilters(f => {
            const next: FilterState = { ...f, ...patch };
            if (f.goal) {
                const owned = new Set(GOAL_BY_ID[f.goal].owns);
                for (const key of Object.keys(patch) as (keyof FilterState)[]) {
                    if (owned.has(key)) { next.goal = null; break; }
                }
            }
            // Explicit sort override turns off auto
            if (patch.sortField && !patch.sortAuto) next.sortAuto = false;
            return next;
        });
    };

    // Filtering
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

    // Active filter chips: goal first (if any), then any non-owned adjustments
    const activeGoal = filters.goal ? GOAL_BY_ID[filters.goal] : null;
    const owned = new Set<keyof FilterState>(activeGoal ? activeGoal.owns : []);

    const activePills: { key: string; label: string; kind: 'goal' | 'refine' | 'clean'; clear: () => void }[] = [];
    if (activeGoal) {
        activePills.push({
            key: 'goal',
            label: activeGoal.label,
            kind: 'goal',
            clear: () => setFilters(f => ({ ...DEFAULT_FILTERS, text: f.text }))
        });
    }
    if (filters.hideAnonymous && !owned.has('hideAnonymous')) activePills.push({ key: 'anon', kind: 'clean', label: 'Named only', clear: () => update({ hideAnonymous: false }) });
    if (filters.onlyMine && !owned.has('onlyMine')) activePills.push({ key: 'mine', kind: 'clean', label: 'My stakes only', clear: () => update({ onlyMine: false }) });
    if (filters.hideHighStake && !owned.has('hideHighStake')) activePills.push({ key: 'hs', kind: 'clean', label: 'Hide high-stake', clear: () => update({ hideHighStake: false }) });
    if (filters.onlyJito && !owned.has('onlyJito')) activePills.push({ key: 'jito', kind: 'clean', label: 'Jito MEV only', clear: () => update({ onlyJito: false }) });
    if (!filters.hideDelinquent && !owned.has('hideDelinquent')) activePills.push({ key: 'del', kind: 'clean', label: 'Including delinquent', clear: () => update({ hideDelinquent: true }) });
    if (filters.minWizScore > 0 && !owned.has('minWizScore')) activePills.push({ key: 'wiz', kind: 'refine', label: 'Wiz ≥ ' + filters.minWizScore + '%', clear: () => update({ minWizScore: 0 }) });
    if (filters.minApy > 0 && !owned.has('minApy')) activePills.push({ key: 'apy', kind: 'refine', label: 'APY ≥ ' + filters.minApy + '%', clear: () => update({ minApy: 0 }) });
    if (filters.maxCommission < 100 && !owned.has('maxCommission')) activePills.push({ key: 'comm', kind: 'refine', label: 'Commission ≤ ' + filters.maxCommission + '%', clear: () => update({ maxCommission: 100 }) });
    if (filters.maxSkipRate < 100 && !owned.has('maxSkipRate')) activePills.push({ key: 'skip', kind: 'refine', label: 'Skip ≤ ' + filters.maxSkipRate + '%', clear: () => update({ maxSkipRate: 100 }) });
    if (!filters.sortAuto) activePills.push({ key: 'sort', kind: 'refine', label: 'Sort: ' + SORT_LABELS[filters.sortField], clear: () => update({ sortField: 'rank_asc', sortAuto: true }) });

    const onlyMineDisabled = !walletValidators || walletValidators.length < 1;
    const selectCount = stakeValidators ? stakeValidators.length : 0;

    const clearAll = () => setFilters({ ...DEFAULT_FILTERS });

    const closeText = () => { setTextOpen(false); update({ text: '' }); };

    return (
        <div className="sw-search-shell" id="vlist-search">
            <div className="sw-search-bar">
                {textOpen ? (
                    <div className="sw-search-text-open">
                        <i className="bi bi-search sw-search-icon" />
                        <input
                            ref={textInputRef}
                            type="text"
                            className="form-control"
                            placeholder="Search by name, identity or paste a vote account…"
                            value={filters.text}
                            autoComplete="off"
                            onChange={e => update({ text: e.target.value })}
                            onKeyDown={e => { if (e.code === 'Escape') closeText(); }}
                        />
                        <button type="button" className="sw-search-clear" onClick={closeText} aria-label="Close search">
                            <i className="bi bi-x-lg" />
                        </button>
                    </div>
                ) : (
                    <>
                        <OverlayTrigger placement="top" overlay={<Tooltip>Search by name or paste a pubkey</Tooltip>}>
                            <button type="button" className="sw-search-toggle" onClick={() => setTextOpen(true)} aria-label="Open search">
                                <i className="bi bi-search" />
                                <span className="sw-search-toggle-label">Search</span>
                            </button>
                        </OverlayTrigger>
                        <div className="sw-goal-scroll">
                            {GOALS.map(g => {
                                const active = filters.goal === g.id;
                                const disabled = g.requiresWallet && onlyMineDisabled;
                                const chip = (
                                    <button
                                        key={g.id}
                                        type="button"
                                        disabled={disabled}
                                        className={'sw-goal-chip' + (active ? ' sw-goal-chip-active' : '') + (disabled ? ' sw-goal-chip-disabled' : '')}
                                        onClick={() => applyGoal(g.id)}
                                    >
                                        <i className={'bi ' + g.icon} />
                                        <span>{g.label}</span>
                                    </button>
                                );
                                return (
                                    <OverlayTrigger key={g.id} placement="top" overlay={
                                        <Tooltip>
                                            {disabled ? 'Connect your wallet to enable' : g.hint}
                                        </Tooltip>
                                    }>
                                        {chip}
                                    </OverlayTrigger>
                                );
                            })}
                        </div>
                        <OverlayTrigger placement="top" overlay={<Tooltip>{refineOpen ? 'Hide advanced filters' : 'Show advanced filters'}</Tooltip>}>
                            <button
                                type="button"
                                className={'sw-refine-btn' + (refineOpen ? ' sw-refine-btn-active' : '')}
                                onClick={() => setRefineOpen(o => !o)}
                            >
                                <i className="bi bi-sliders" />
                                <span>Refine</span>
                            </button>
                        </OverlayTrigger>
                    </>
                )}
            </div>

            <div className="sw-search-meta-row">
                <div className="sw-result-count">
                    <strong>{filtered.length.toLocaleString()}</strong>
                    <span>of {validators ? validators.length.toLocaleString() : 0} validators</span>
                </div>
                <div className="sw-search-meta-actions">
                    <OverlayTrigger placement="top" overlay={<Tooltip>{showListView ? 'Card view' : 'List view'}</Tooltip>}>
                        <button type="button" className="sw-icon-btn" onClick={() => updateListView(!showListView)}>
                            <i className={'bi ' + (showListView ? 'bi-grid-3x3-gap' : 'bi-list-ul')} />
                        </button>
                    </OverlayTrigger>
                    <button
                        type="button"
                        className="sw-stake-select"
                        onClick={() => updateMultiStakeModal(true)}
                        disabled={selectCount === 0}
                    >
                        <i className={'bi ' + (selectCount === 0 ? 'bi-minecart' : 'bi-minecart-loaded') + ' me-1'} />
                        {selectCount} selected
                    </button>
                </div>
            </div>

            {refineOpen ? (
                <div className="sw-refine-panel">
                    <div className="sw-slider-grid">
                        <RangeRow label="Wiz Score" value={filters.minWizScore} min={0} max={100} step={1} unit="%" kind="min" onChange={v => update({ minWizScore: v })} />
                        <RangeRow label="TrueAPY" value={filters.minApy} min={0} max={12} step={0.1} unit="%" kind="min" onChange={v => update({ minApy: v })} />
                        <RangeRow label="Commission" value={filters.maxCommission} min={0} max={100} step={1} unit="%" kind="max" onChange={v => update({ maxCommission: v })} />
                        <RangeRow label="Skip rate" value={filters.maxSkipRate} min={0} max={100} step={0.5} unit="%" kind="max" onChange={v => update({ maxSkipRate: v })} />
                    </div>
                    <div className="sw-refine-controls">
                        <label className="sw-switch">
                            <input type="checkbox" checked={!filters.hideDelinquent} onChange={e => update({ hideDelinquent: !e.target.checked })} />
                            <span>Show delinquent validators</span>
                        </label>
                        <label className="sw-switch">
                            <input type="checkbox" checked={filters.hideAnonymous} onChange={e => update({ hideAnonymous: e.target.checked })} />
                            <span>Named validators only</span>
                        </label>
                        <label className="sw-switch">
                            <input type="checkbox" checked={filters.hideHighStake} onChange={e => update({ hideHighStake: e.target.checked })} />
                            <span>Hide high-stake validators</span>
                        </label>
                        <OverlayTrigger placement="top" overlay={<Tooltip>{onlyMineDisabled ? 'Connect your wallet to enable' : 'Only validators you have stakes with'}</Tooltip>}>
                            <label className={'sw-switch' + (onlyMineDisabled ? ' sw-switch-disabled' : '')}>
                                <input type="checkbox" disabled={onlyMineDisabled} checked={filters.onlyMine} onChange={e => update({ onlyMine: e.target.checked })} />
                                <span>My stakes only</span>
                            </label>
                        </OverlayTrigger>
                        <div className="sw-sort-select-wrap">
                            <label htmlFor="sw-sort-select" className="sw-sort-label">Sort by</label>
                            <select
                                id="sw-sort-select"
                                className="form-select form-select-sm sw-sort-select"
                                value={filters.sortField}
                                onChange={e => update({ sortField: e.target.value as SortKey, sortAuto: false })}
                            >
                                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                                    <option key={k} value={k}>{SORT_LABELS[k]}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            ) : null}

            {activePills.length > 0 ? (
                <div className="sw-active-filters">
                    <span className="sw-active-label">Active</span>
                    {activePills.map(p => (
                        <button key={p.key} type="button" className={'sw-active-pill sw-active-pill-' + p.kind} onClick={p.clear}>
                            {p.kind === 'goal' ? <i className="bi bi-bullseye me-1" /> : null}
                            {p.label}
                            <i className="bi bi-x ms-1" />
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
