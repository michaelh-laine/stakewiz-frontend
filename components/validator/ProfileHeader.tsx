import React, { FC, useState } from 'react';
import Link from 'next/link';
import ordinal from 'ordinal';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { validatorI } from './interfaces';
import { RenderImage, RenderName } from './common';
import ShareCardModal from './ShareCardModal';

interface ProfileHeaderProps {
    validator: validatorI;
    connected: boolean;
    onStake: () => void;
    onAlert: () => void;
}

const shorten = (s: string, chars = 6) => {
    if (!s) return '';
    if (s.length <= chars * 2 + 3) return s;
    return s.slice(0, chars) + '…' + s.slice(-chars);
};

const KpiTile: FC<{ label: string; value: string; help?: string }> = ({ label, value, help }) => {
    const tile = (
        <div className="sw-profile-kpi">
            <div className="sw-stat-label">{label}</div>
            <div className="sw-stat-value">{value}</div>
        </div>
    );
    if (help) {
        return <OverlayTrigger placement="top" overlay={<Tooltip>{help}</Tooltip>}>{tile}</OverlayTrigger>;
    }
    return tile;
};

const ProfileHeader: FC<ProfileHeaderProps> = ({ validator, connected, onStake, onAlert }) => {
    const [showShare, setShowShare] = useState<boolean>(false);
    const [claimDismissed, setClaimDismissed] = useState<boolean>(false);

    const xHandle = validator?.website && /(twitter\.com|x\.com)/i.test(validator.website)
        ? validator.website.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, '@').replace(/\/$/, '')
        : null;

    const isClaimed = false; // Wire this to API when profile-ownership ships.

    return (
        <>
            <section className="sw-profile-header">
                <Link href="/" passHref legacyBehavior>
                    <a className="sw-profile-back">
                        <i className="bi bi-arrow-left" /> Back to validators
                    </a>
                </Link>

                <div className="sw-profile-hero">
                    <div className="sw-profile-avatar">
                        <RenderImage
                            img={validator.image}
                            vote_identity={validator.vote_identity}
                            size={110}
                        />
                        {validator.delinquent ? (
                            <span className="sw-profile-status-pill sw-profile-status-delinquent">
                                <i className="bi bi-exclamation-triangle-fill me-1" /> Delinquent
                            </span>
                        ) : (
                            <span className="sw-profile-status-pill sw-profile-status-healthy">
                                <i className="bi bi-check-circle-fill me-1" /> Active
                            </span>
                        )}
                    </div>

                    <div className="sw-profile-main">
                        <div className="sw-profile-badges">
                            <span className="sw-profile-rank">Ranked {ordinal(validator.rank)} on Stakewiz</span>
                            {validator.is_jito ? (
                                <span className="sw-pill sw-pill-jito">JITO {validator.jito_commission_bps / 100}%</span>
                            ) : null}
                            {validator.above_halt_line ? (
                                <span className="sw-pill sw-pill-emerald">Above halt line</span>
                            ) : null}
                            {isClaimed ? (
                                <span className="sw-pill sw-pill-verified">
                                    <i className="bi bi-patch-check-fill me-1" /> Claimed profile
                                </span>
                            ) : null}
                        </div>
                        <h1 className="sw-profile-name">
                            <RenderName validator={validator} />
                        </h1>
                        {validator.description ? (
                            <p className="sw-profile-desc">{validator.description}</p>
                        ) : null}

                        <div className="sw-profile-links">
                            {validator.website && !xHandle ? (
                                <a href={validator.website} target="_blank" rel="noopener noreferrer" className="sw-profile-link">
                                    <i className="bi bi-globe me-1" /> Website
                                </a>
                            ) : null}
                            {xHandle ? (
                                <a href={validator.website} target="_blank" rel="noopener noreferrer" className="sw-profile-link">
                                    <i className="bi bi-twitter-x me-1" /> {xHandle}
                                </a>
                            ) : null}
                            <OverlayTrigger placement="top" overlay={<Tooltip>Copy identity: {validator.identity}</Tooltip>}>
                                <button
                                    type="button"
                                    className="sw-profile-link sw-profile-link-btn"
                                    onClick={() => navigator.clipboard.writeText(validator.identity)}
                                >
                                    <i className="bi bi-fingerprint me-1" /> {shorten(validator.identity)}
                                </button>
                            </OverlayTrigger>
                            <OverlayTrigger placement="top" overlay={<Tooltip>Copy vote account: {validator.vote_identity}</Tooltip>}>
                                <button
                                    type="button"
                                    className="sw-profile-link sw-profile-link-btn"
                                    onClick={() => navigator.clipboard.writeText(validator.vote_identity)}
                                >
                                    <i className="bi bi-hash me-1" /> {shorten(validator.vote_identity)}
                                </button>
                            </OverlayTrigger>
                        </div>
                    </div>

                    <div className="sw-profile-actions">
                        <button
                            type="button"
                            className="btn sw-btn-primary sw-profile-action"
                            onClick={onStake}
                            disabled={!connected}
                        >
                            <i className="bi bi-plus-circle me-2" /> Stake
                        </button>
                        <button type="button" className="btn sw-btn-ghost sw-profile-action" onClick={onAlert}>
                            <i className="bi bi-bell me-2" /> Alert
                        </button>
                        <button type="button" className="btn sw-btn-ghost sw-profile-action" onClick={() => setShowShare(true)}>
                            <i className="bi bi-share me-2" /> Share
                        </button>
                    </div>
                </div>

                <div className="sw-profile-kpis">
                    <KpiTile label="Wiz Score" value={validator.wiz_score + '%'} help="Composite score of performance, decentralization, commission and info." />
                    <KpiTile label="TrueAPY" value={validator.total_apy + '%'} help="10-epoch median APY including Jito MEV where applicable." />
                    <KpiTile label="Commission" value={validator.commission + '%'} help="Percentage of rewards kept by validator." />
                    <KpiTile label="Skip rate" value={validator.skip_rate.toFixed(1) + '%'} help="Percentage of leader slots the validator failed to produce a block." />
                    <KpiTile label="Vote rate" value={validator.credit_ratio.toFixed(1) + '%'} help="Credits earned as a share of possible credits." />
                    <KpiTile label="Uptime (30d)" value={validator.uptime.toFixed(2) + '%'} help="Rolling 30-day uptime." />
                </div>
            </section>

            {!isClaimed && !claimDismissed ? (
                <div className="sw-claim-strip">
                    <div className="sw-claim-copy">
                        <div className="sw-claim-title">
                            <i className="bi bi-patch-question me-2" /> Are you the operator of{' '}
                            {validator.name ? <strong>{validator.name}</strong> : 'this validator'}?
                        </div>
                        <div className="sw-claim-sub">
                            Claim your profile to post updates, add a bio, link your socials and respond to stakers.
                        </div>
                    </div>
                    <div className="sw-claim-actions">
                        <button type="button" className="btn sw-btn-primary sw-claim-cta">
                            <i className="bi bi-patch-check me-2" /> Claim profile
                        </button>
                        <button
                            type="button"
                            className="sw-claim-dismiss"
                            aria-label="Dismiss claim prompt"
                            onClick={() => setClaimDismissed(true)}
                        >
                            <i className="bi bi-x-lg" />
                        </button>
                    </div>
                </div>
            ) : null}

            <ShareCardModal show={showShare} onHide={() => setShowShare(false)} validator={validator} />
        </>
    );
};

export default ProfileHeader;
