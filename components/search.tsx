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
    minWizScore: number; maxWizScore: number;
    minApy: number; maxApy: number;
    minCommission: number; maxCommission: number;
    minSkipRate: number; maxSkipRate: number;
    /** Log10 SOL — 0 = 1, 3 = 1K, 6 = 1M, 8 = 100M */
    minStakeLog: number; maxStakeLog: number;
    hideAnonymous: boolean;
    hideHighStake: boolean;
    hideDelinquent: boolean;
    onlyJito: boolean;
    onlyMine: boolean;
    sortField: SortKey;
    /** True when sort is following the active goal; false when user overrode. */
    sortAuto: boolean;
}

// Stake filter is log-scaled — stake distribution spans 6 orders of magnitude.
const STAKE_LOG_MIN = 0; // 1 SOL
const STAKE_LOG_MAX = 8; // 100M SOL (well above the largest validator)

const DEFAULT_FILTERS: FilterState = {
    text: '', goal: null,
    minWizScore: 0, maxWizScore: 100,
    minApy: 0, maxApy: 15,
    minCommission: 0, maxCommission: 100,
    minSkipRate: 0, maxSkipRate: 100,
    minStakeLog: STAKE_LOG_MIN, maxStakeLog: STAKE_LOG_MAX,
    hideAnonymous: false, hideHighStake: false, hideDelinquent: true,
    onlyJito: false, onlyMine: false,
    sortField: 'rank_asc', sortAuto: true
};

const isAtDefault = (f: FilterState, key: keyof FilterState): boolean => f[key] === DEFAULT_FILTERS[key];

const formatStake = (sol: number): string => {
    if (sol >= 1_000_000) return (sol / 1_000_000).toFixed(sol >= 10_000_000 ? 0 : 1) + 'M';
    if (sol >= 1_000) return (sol / 1_000).toFixed(sol >= 10_000 ? 0 : 1) + 'K';
    if (sol >= 10) return sol.toFixed(0);
    return sol.toFixed(1);
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

interface DualRangeProps {
    label: string;
    min: number;
    max: number;
    step: number;
    minValue: number;
    maxValue: number;
    onChange: (patch: { min?: number; max?: number }) => void;
    /** Formatter used both on the visual labels and in the numeric inputs. */
    format?: (v: number) => string;
    /** Parser for numeric input strings back into the slider's value domain. */
    parse?: (s: string) => number | null;
    /** Suffix shown after the input value (e.g. '%'). */
    unit?: string;
    /** Hint text below the range (e.g. exact SOL values for a log slider). */
    hint?: string;
}

const DualRange: FC<DualRangeProps> = ({ label, min, max, step, minValue, maxValue, onChange, format, parse, unit = '', hint }) => {
    const fmt = format || ((v: number) => String(v));
    const [minText, setMinText] = useState<string>(fmt(minValue));
    const [maxText, setMaxText] = useState<string>(fmt(maxValue));
    /** Which thumb the pointer is closest to — that one floats to the top so
        it always wins the click even when both thumbs sit at the same value. */
    const [activeThumb, setActiveThumb] = useState<'min' | 'max'>('min');
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMinText(fmt(minValue)); }, [minValue]);
    useEffect(() => { setMaxText(fmt(maxValue)); }, [maxValue]);

    const range = max - min;
    const minPct = ((minValue - min) / range) * 100;
    const maxPct = ((maxValue - min) / range) * 100;

    const commit = (kind: 'min' | 'max', raw: string) => {
        const parsed = parse ? parse(raw) : Number(raw.replace(/[^0-9.\-]/g, ''));
        if (parsed == null || Number.isNaN(parsed)) return;
        const clamped = Math.max(min, Math.min(max, parsed));
        if (kind === 'min') {
            onChange({ min: Math.min(clamped, maxValue) });
        } else {
            onChange({ max: Math.max(clamped, minValue) });
        }
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!wrapRef.current) return;
        const rect = wrapRef.current.getBoundingClientRect();
        if (rect.width === 0) return;
        const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const distMin = Math.abs(pct - minPct);
        const distMax = Math.abs(pct - maxPct);
        setActiveThumb(distMax < distMin ? 'max' : 'min');
    };

    return (
        <div className="sw-dual-range">
            <div className="sw-dual-head">
                <span className="sw-dual-label">{label}</span>
                <span className="sw-dual-range-summary">{fmt(minValue)}{unit} – {fmt(maxValue)}{unit}</span>
            </div>
            <div
                ref={wrapRef}
                className="sw-dual-track-wrap"
                onPointerMove={onPointerMove}
            >
                <div className="sw-dual-track">
                    <div className="sw-dual-track-fill" style={{ left: minPct + '%', width: (maxPct - minPct) + '%' }} />
                </div>
                <input
                    type="range"
                    className={'sw-dual-thumb sw-dual-thumb-min' + (activeThumb === 'min' ? ' sw-dual-thumb-active' : '')}
                    min={min}
                    max={max}
                    step={step}
                    value={minValue}
                    onChange={e => {
                        const v = Math.min(Number(e.target.value), maxValue);
                        onChange({ min: v });
                    }}
                    aria-label={label + ' minimum'}
                />
                <input
                    type="range"
                    className={'sw-dual-thumb sw-dual-thumb-max' + (activeThumb === 'max' ? ' sw-dual-thumb-active' : '')}
                    min={min}
                    max={max}
                    step={step}
                    value={maxValue}
                    onChange={e => {
                        const v = Math.max(Number(e.target.value), minValue);
                        onChange({ max: v });
                    }}
                    aria-label={label + ' maximum'}
                />
            </div>
            <div className="sw-dual-inputs">
                <label className="sw-dual-input">
                    <span>Min</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={minText}
                        onChange={e => setMinText(e.target.value)}
                        onBlur={e => commit('min', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                </label>
                <label className="sw-dual-input">
                    <span>Max</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={maxText}
                        onChange={e => setMaxText(e.target.value)}
                        onBlur={e => commit('max', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                </label>
            </div>
            {hint ? <div className="sw-dual-hint">{hint}</div> : null}
        </div>
    );
};

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
    const minStakeSol = Math.pow(10, filters.minStakeLog);
    const maxStakeSol = Math.pow(10, filters.maxStakeLog);

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
            if (v.wiz_score < filters.minWizScore || v.wiz_score > filters.maxWizScore) return false;
            if (v.total_apy < filters.minApy || v.total_apy > filters.maxApy) return false;
            if (v.commission < filters.minCommission || v.commission > filters.maxCommission) return false;
            if (v.skip_rate < filters.minSkipRate || v.skip_rate > filters.maxSkipRate) return false;
            const stake = v.activated_stake || 0;
            if (stake < minStakeSol || stake > maxStakeSol) return false;
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

    const wizMinOn = filters.minWizScore > DEFAULT_FILTERS.minWizScore && !owned.has('minWizScore');
    const wizMaxOn = filters.maxWizScore < DEFAULT_FILTERS.maxWizScore && !owned.has('maxWizScore');
    if (wizMinOn || wizMaxOn) activePills.push({ key: 'wiz', kind: 'refine',
        label: 'Wiz ' + filters.minWizScore + '–' + filters.maxWizScore + '%',
        clear: () => update({ minWizScore: DEFAULT_FILTERS.minWizScore, maxWizScore: DEFAULT_FILTERS.maxWizScore }) });

    const apyMinOn = filters.minApy > DEFAULT_FILTERS.minApy && !owned.has('minApy');
    const apyMaxOn = filters.maxApy < DEFAULT_FILTERS.maxApy && !owned.has('maxApy');
    if (apyMinOn || apyMaxOn) activePills.push({ key: 'apy', kind: 'refine',
        label: 'APY ' + filters.minApy + '–' + filters.maxApy + '%',
        clear: () => update({ minApy: DEFAULT_FILTERS.minApy, maxApy: DEFAULT_FILTERS.maxApy }) });

    const commMinOn = filters.minCommission > DEFAULT_FILTERS.minCommission && !owned.has('minCommission');
    const commMaxOn = filters.maxCommission < DEFAULT_FILTERS.maxCommission && !owned.has('maxCommission');
    if (commMinOn || commMaxOn) activePills.push({ key: 'comm', kind: 'refine',
        label: 'Commission ' + filters.minCommission + '–' + filters.maxCommission + '%',
        clear: () => update({ minCommission: DEFAULT_FILTERS.minCommission, maxCommission: DEFAULT_FILTERS.maxCommission }) });

    const skipMinOn = filters.minSkipRate > DEFAULT_FILTERS.minSkipRate && !owned.has('minSkipRate');
    const skipMaxOn = filters.maxSkipRate < DEFAULT_FILTERS.maxSkipRate && !owned.has('maxSkipRate');
    if (skipMinOn || skipMaxOn) activePills.push({ key: 'skip', kind: 'refine',
        label: 'Skip ' + filters.minSkipRate + '–' + filters.maxSkipRate + '%',
        clear: () => update({ minSkipRate: DEFAULT_FILTERS.minSkipRate, maxSkipRate: DEFAULT_FILTERS.maxSkipRate }) });

    const stakeMinOn = filters.minStakeLog > DEFAULT_FILTERS.minStakeLog && !owned.has('minStakeLog');
    const stakeMaxOn = filters.maxStakeLog < DEFAULT_FILTERS.maxStakeLog && !owned.has('maxStakeLog');
    if (stakeMinOn || stakeMaxOn) activePills.push({ key: 'stake', kind: 'refine',
        label: 'Stake ◎ ' + formatStake(Math.pow(10, filters.minStakeLog)) + '–' + formatStake(Math.pow(10, filters.maxStakeLog)),
        clear: () => update({ minStakeLog: DEFAULT_FILTERS.minStakeLog, maxStakeLog: DEFAULT_FILTERS.maxStakeLog }) });

    if (!filters.sortAuto) activePills.push({ key: 'sort', kind: 'refine', label: 'Sort: ' + SORT_LABELS[filters.sortField], clear: () => update({ sortField: 'rank_asc', sortAuto: true }) });

    const onlyMineDisabled = !walletValidators || walletValidators.length < 1;
    const selectCount = stakeValidators ? stakeValidators.length : 0;

    const clearAll = () => setFilters({ ...DEFAULT_FILTERS });

    const closeText = () => { setTextOpen(false); update({ text: '' }); };

    return (
        <div className="sw-search-shell" id="vlist-search">
            <div className="sw-search-bar">
                <div className={'sw-search-field' + (textOpen ? ' sw-search-field-open' : '')}>
                    <i className="bi bi-search sw-search-icon" />
                    <input
                        ref={textInputRef}
                        type="text"
                        className="form-control sw-search-input-el"
                        placeholder="Search validators…"
                        value={filters.text}
                        autoComplete="off"
                        onFocus={() => setTextOpen(true)}
                        onChange={e => update({ text: e.target.value })}
                        onBlur={() => { if (!filters.text) setTextOpen(false); }}
                        onKeyDown={e => { if (e.code === 'Escape') { closeText(); (e.target as HTMLInputElement).blur(); } }}
                    />
                    {filters.text ? (
                        <button
                            type="button"
                            className="sw-search-clear"
                            onMouseDown={e => e.preventDefault()}
                            onClick={closeText}
                            aria-label="Clear search"
                        >
                            <i className="bi bi-x-lg" />
                        </button>
                    ) : null}
                </div>
                <div className={'sw-search-rest' + (textOpen ? ' sw-search-rest-hidden' : '')} aria-hidden={textOpen}>
                    <div className="sw-goal-scroll">
                        {GOALS.map(g => {
                            const active = filters.goal === g.id;
                            const disabled = g.requiresWallet && onlyMineDisabled;
                            const chip = (
                                <button
                                    key={g.id}
                                    type="button"
                                    disabled={disabled}
                                    tabIndex={textOpen ? -1 : 0}
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
                            tabIndex={textOpen ? -1 : 0}
                            className={'sw-refine-btn' + (refineOpen ? ' sw-refine-btn-active' : '')}
                            onClick={() => setRefineOpen(o => !o)}
                        >
                            <i className="bi bi-sliders" />
                            <span>Refine</span>
                        </button>
                    </OverlayTrigger>
                </div>
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
                        <DualRange
                            label="Wiz Score"
                            min={0} max={100} step={1} unit="%"
                            minValue={filters.minWizScore} maxValue={filters.maxWizScore}
                            onChange={p => update({
                                minWizScore: p.min ?? filters.minWizScore,
                                maxWizScore: p.max ?? filters.maxWizScore
                            })}
                        />
                        <DualRange
                            label="TrueAPY"
                            min={0} max={15} step={0.1} unit="%"
                            minValue={filters.minApy} maxValue={filters.maxApy}
                            format={v => v.toFixed(1)}
                            onChange={p => update({
                                minApy: p.min ?? filters.minApy,
                                maxApy: p.max ?? filters.maxApy
                            })}
                        />
                        <DualRange
                            label="Commission"
                            min={0} max={100} step={1} unit="%"
                            minValue={filters.minCommission} maxValue={filters.maxCommission}
                            onChange={p => update({
                                minCommission: p.min ?? filters.minCommission,
                                maxCommission: p.max ?? filters.maxCommission
                            })}
                        />
                        <DualRange
                            label="Skip rate"
                            min={0} max={100} step={0.5} unit="%"
                            minValue={filters.minSkipRate} maxValue={filters.maxSkipRate}
                            format={v => v.toFixed(1)}
                            onChange={p => update({
                                minSkipRate: p.min ?? filters.minSkipRate,
                                maxSkipRate: p.max ?? filters.maxSkipRate
                            })}
                        />
                        <DualRange
                            label="Stake (SOL)"
                            min={STAKE_LOG_MIN} max={STAKE_LOG_MAX} step={0.1}
                            minValue={filters.minStakeLog} maxValue={filters.maxStakeLog}
                            format={v => '◎ ' + formatStake(Math.pow(10, v))}
                            parse={s => {
                                const cleaned = s.replace(/[◎,\s]/g, '').toUpperCase();
                                const m = cleaned.match(/^(-?\d*\.?\d+)([KM]?)$/);
                                if (!m) return null;
                                let n = parseFloat(m[1]);
                                if (m[2] === 'K') n *= 1_000;
                                if (m[2] === 'M') n *= 1_000_000;
                                if (n <= 0) return STAKE_LOG_MIN;
                                return Math.log10(n);
                            }}
                            onChange={p => update({
                                minStakeLog: p.min ?? filters.minStakeLog,
                                maxStakeLog: p.max ?? filters.maxStakeLog
                            })}
                            hint="Log-scaled: drag either end or type e.g. 50K, 1.5M"
                        />
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
