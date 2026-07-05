import { FC, useEffect, useMemo, useState } from "react";
import axios from "axios";
import config from '../../config.json'
import { Spinner } from '../common'
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const API_URL = process.env.API_BASE_URL;

interface StakeAccount {
    pubkey: string;
    delegated_amount: string | number;
}

interface EpochStakeData {
    activating: { amount: number; stake_accounts: StakeAccount[] };
    deactivating: { amount: number; stake_accounts: StakeAccount[] };
}

const shortenPubkey = (s: string, chars = 5) => {
    if (!s) return '';
    if (s.length <= chars * 2 + 3) return s;
    return s.slice(0, chars) + '…' + s.slice(-chars);
};

const formatSol = (v: number): string => {
    if (!v) return '0';
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
    if (v >= 10_000) return (v / 1_000).toFixed(1) + 'K';
    if (v >= 1_000) return new Intl.NumberFormat().format(Math.round(v));
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
};

export const EpochStakeChart: FC<{vote_identity: string, updateStake: Function}> = ({vote_identity, updateStake}) => {
    const [data, setData] = useState<EpochStakeData | null>(null);

    useEffect(() => {
        axios(API_URL+config.API_ENDPOINTS.validator_epoch_stake_accounts+"/"+vote_identity, {
            headers: {'Content-Type':'application/json'}
        })
            .then(response => {
                const json: EpochStakeData = response.data;
                const change = json.activating.amount - json.deactivating.amount;
                updateStake(change);
                setData(json);
            })
            .catch(e => { console.log(e); });
    }, []);

    const derived = useMemo(() => {
        if (!data) return null;
        const activatingTotal = Number(data.activating.amount) || 0;
        const deactivatingTotal = Number(data.deactivating.amount) || 0;
        const net = activatingTotal - deactivatingTotal;
        const combined = activatingTotal + deactivatingTotal;
        const activatingShare = combined > 0 ? (activatingTotal / combined) * 100 : 0;
        const deactivatingShare = combined > 0 ? (deactivatingTotal / combined) * 100 : 0;

        const topActivating = [...(data.activating.stake_accounts || [])]
            .map(s => ({ pubkey: s.pubkey, amount: Number(s.delegated_amount) || 0 }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 4);
        const topDeactivating = [...(data.deactivating.stake_accounts || [])]
            .map(s => ({ pubkey: s.pubkey, amount: Number(s.delegated_amount) || 0 }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 4);

        return {
            activatingTotal, deactivatingTotal, net,
            activatingCount: data.activating.stake_accounts?.length || 0,
            deactivatingCount: data.deactivating.stake_accounts?.length || 0,
            activatingShare, deactivatingShare,
            topActivating, topDeactivating,
            hasAny: combined > 0
        };
    }, [data]);

    if (!data || !derived) return <Spinner />;

    if (!derived.hasAny) {
        return (
            <div className="sw-epoch-empty">
                <div className="sw-epoch-empty-icon"><i className="bi bi-hourglass" /></div>
                <div>
                    <div className="sw-epoch-empty-title">No stake changes this epoch</div>
                    <div className="sw-epoch-empty-sub">No stake accounts activating or deactivating right now.</div>
                </div>
            </div>
        );
    }

    const netPositive = derived.net >= 0;

    return (
        <div className="sw-epoch">
            <div className="sw-epoch-summary">
                <div className="sw-epoch-kpi sw-epoch-kpi-in">
                    <div className="sw-epoch-kpi-label">
                        <i className="bi bi-arrow-up-right-circle-fill" /> Activating
                    </div>
                    <div className="sw-epoch-kpi-value">◎ {formatSol(derived.activatingTotal)}</div>
                    <div className="sw-epoch-kpi-sub">{derived.activatingCount} stake account{derived.activatingCount === 1 ? '' : 's'}</div>
                </div>
                <div className="sw-epoch-kpi sw-epoch-kpi-out">
                    <div className="sw-epoch-kpi-label">
                        <i className="bi bi-arrow-down-left-circle-fill" /> Deactivating
                    </div>
                    <div className="sw-epoch-kpi-value">◎ {formatSol(derived.deactivatingTotal)}</div>
                    <div className="sw-epoch-kpi-sub">{derived.deactivatingCount} stake account{derived.deactivatingCount === 1 ? '' : 's'}</div>
                </div>
            </div>

            <div className={'sw-epoch-net sw-epoch-net-' + (netPositive ? 'positive' : 'negative')}>
                <span className="sw-epoch-net-label">Net change next epoch</span>
                <span className="sw-epoch-net-value">
                    {netPositive ? '+' : '−'} ◎ {formatSol(Math.abs(derived.net))}
                </span>
            </div>

            <div className="sw-epoch-bar" aria-label="Composition of stake changes">
                <div
                    className="sw-epoch-bar-in"
                    style={{ width: derived.activatingShare + '%' }}
                    title={derived.activatingShare.toFixed(1) + '% activating'}
                />
                <div
                    className="sw-epoch-bar-out"
                    style={{ width: derived.deactivatingShare + '%' }}
                    title={derived.deactivatingShare.toFixed(1) + '% deactivating'}
                />
            </div>
            <div className="sw-epoch-bar-legend">
                <span>{derived.activatingShare.toFixed(0)}% in</span>
                <span>{derived.deactivatingShare.toFixed(0)}% out</span>
            </div>

            {(derived.topActivating.length > 0 || derived.topDeactivating.length > 0) ? (
                <div className="sw-epoch-movers">
                    {derived.topActivating.length > 0 ? (
                        <div className="sw-epoch-mover-column">
                            <div className="sw-epoch-mover-title">Top activating</div>
                            {derived.topActivating.map(m => (
                                <MoverRow key={m.pubkey} pubkey={m.pubkey} amount={m.amount} direction="in" />
                            ))}
                        </div>
                    ) : null}
                    {derived.topDeactivating.length > 0 ? (
                        <div className="sw-epoch-mover-column">
                            <div className="sw-epoch-mover-title">Top deactivating</div>
                            {derived.topDeactivating.map(m => (
                                <MoverRow key={m.pubkey} pubkey={m.pubkey} amount={m.amount} direction="out" />
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

const MoverRow: FC<{ pubkey: string; amount: number; direction: 'in' | 'out' }> = ({ pubkey, amount, direction }) => (
    <OverlayTrigger placement="top" overlay={<Tooltip>Click to copy: {pubkey}</Tooltip>}>
        <button
            type="button"
            className={'sw-epoch-mover sw-epoch-mover-' + direction}
            onClick={() => navigator.clipboard.writeText(pubkey)}
        >
            <span className="sw-epoch-mover-pubkey">{shortenPubkey(pubkey)}</span>
            <span className="sw-epoch-mover-amount">
                {direction === 'in' ? '+' : '−'} ◎ {formatSol(amount)}
            </span>
        </button>
    </OverlayTrigger>
);
