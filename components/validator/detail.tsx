import React, { useRef, FC, useContext } from 'react';
import axios from 'axios';
import config from '../../config.json';
import { validatorI, ValidatorBoxPropsI, ValidatorListI, ValidatorListingI, validatorDetailI, clusterStatsI } from './interfaces'
import {checkSolflareEnabled, ConditionalWrapper, getClusterStats, Spinner} from '../common'
import { RenderImage, RenderName, RenderUrl, StakeLabel } from './common';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Gauges } from './gauges';
import { StakeHistoryChart } from './stake_history';
import { WizScoreBody, WizScoreChart } from '../wizscore';
import { DelinquencyChart } from './delinquency';
import { EpochStakeChart } from './epoch_stake';
import { AlertForm } from '../alert';
import { StakeDialog } from '../stake/single-stake';
import { getCommissionHistory, getJitoCommissionHistory } from '../stake/common';
import { CommissionHistoryI, JitoCommissionHistoryI } from '../stake/interfaces';
import * as browser from '../../lib/browser';
import { VoteSuccessChart } from './vote_success';
import { SkipRateChart } from './skip_rate';
import ProfileHeader from './ProfileHeader';
import ProfileNav from './ProfileNav';
import ValidatorUpdates from './ValidatorUpdates';
import { pushRecentValidator } from '../home/RecentlyViewed';

const API_URL = process.env.API_BASE_URL;

class ValidatorDetail extends React.Component<validatorDetailI, 
    {
        validator: validatorI|null;
        stake_change: number|null;
        showStakeModal: boolean;
        clusterStats: clusterStatsI|null;
        commissionHistory: CommissionHistoryI[]|null;
        jitoCommissionHistory: JitoCommissionHistoryI[]|null;
    }> {
    constructor(props) {
        super(props);
        this.state = {
            validator: null,
            stake_change: null,
            showStakeModal: false,
            clusterStats: null,
            commissionHistory: null,
            jitoCommissionHistory: null,
        };
        if(this.props.vote_identity!='') this.getValidator();
        if(this.state.clusterStats==null) getClusterStats().then((stats) => {
            this.setState({
                clusterStats: stats
            });
        });
        if(this.state.commissionHistory==null) getCommissionHistory(this.props.vote_identity).then((history) => {
            this.setState({
                commissionHistory: history
            })
        })
        if(this.state.jitoCommissionHistory==null) getJitoCommissionHistory(this.props.vote_identity).then((history) => {
            this.setState({
                jitoCommissionHistory: history
            })
        })
    }
    getValidator() {
        axios(API_URL+config.API_ENDPOINTS.validator+'/'+this.props.vote_identity, {
          headers: {'Content-Type':'application/json'}
        })
          .then(response => {
            let json = response.data as validatorI;
            
            
            this.setState({
                validator: json
            })

            let title = this.props.vote_identity;
            if(json.name!='') title = json.name;

            this.props.updateTitle(title);
            pushRecentValidator(json.vote_identity);
          })
          .catch(e => {
            console.log(e);
            setTimeout(() => { this.getValidator() }, 5000);
          })
    }

    renderName() {
        if(this.state.validator!==null) {
            if(this.state.validator.name=='') {
                return this.state.validator.vote_identity;
            }
            else return this.state.validator.name;
        }
    }

    updateStakeChange(change) {
        
        this.setState({
            stake_change: change
        });
    }

    renderCommissionLabel() {
        if(this.state.commissionHistory!==null && this.state.validator !== null) {
            if(this.state.commissionHistory.length>0) {
                if(this.state.commissionHistory[0].commission == this.state.validator.commission) {
                    let isSafari:boolean = browser.check('Safari');

                    let since: Date|null = null

                    if(isSafari){
                        let timeZone = this.state.commissionHistory[0].observed_at.slice(-3)+':00';
                        since = new Date(this.state.commissionHistory[0].observed_at.substring(0, 19).replace(/-/g, "/")+timeZone)
                    }else{                
                        since = new Date(this.state.commissionHistory[0].observed_at)
                    }
                    return (
                        <div className='badge bg-light text-dark badge-sm mx-1'>
                            Since {since.toLocaleDateString(undefined, {
                                dateStyle: "medium"
                            })}
                        </div>
                    )
                }
            }
        }
    }

    renderJitoCommissionLabel() {
        if(this.state.validator !== null && this.state.validator.is_jito) {
            const jitoPct = this.state.validator.jito_commission_bps / 100;
            const high = jitoPct > 10;
            return (
                <OverlayTrigger
                    placement="top"
                    overlay={
                        <Tooltip>
                            {high
                                ? 'Caution: High MEV commission. This is the commission charged on MEV tips earned through Jito, remainder goes to stakers.'
                                : 'Commission charged on MEV tips earned through Jito, remainder goes to stakers.'}
                        </Tooltip>
                    }
                >
                    <span className={'sw-commission-mev' + (high ? ' sw-commission-mev-warn' : '')}>
                        <i className='bi bi-lightning-charge-fill me-1' />
                        MEV {jitoPct}%
                    </span>
                </OverlayTrigger>
            );
        }
    }

    renderCommissionTimeline(events: any[], kind: 'std' | 'jito') {
        if (!events || events.length === 0) {
            return (
                <div className="sw-commission-empty">
                    <i className="bi bi-clock-history sw-commission-empty-icon" />
                    <div>
                        <div className="sw-commission-empty-title">
                            {kind === 'std'
                                ? 'No commission changes on record'
                                : 'No Jito MEV commission changes on record'}
                        </div>
                        <div className="sw-commission-empty-sub">
                            Stakewiz data begins from 28 Dec 2021.
                        </div>
                    </div>
                </div>
            );
        }

        const isSafari: boolean = browser.check('Safari');
        const parseDate = (raw: string) => {
            if (!raw) return null;
            if (isSafari) {
                const tz = raw.slice(-3) + ':00';
                return new Date(raw.substring(0, 19).replace(/-/g, '/') + tz);
            }
            return new Date(raw);
        };

        const getCommission = (e: any): number | null => {
            if (kind === 'std') return e.commission;
            return e.commission_bps == null ? null : e.commission_bps / 100;
        };

        const points = events.map((e, i) => {
            const current = getCommission(e);
            const previous = i + 1 < events.length ? getCommission(events[i + 1]) : null;
            const dateRaw = kind === 'std' ? e.observed_at : e.created_at;
            const date = parseDate(dateRaw);
            return { current, previous, date, isLast: i === events.length - 1 };
        });

        const values = points
            .map(p => p.current)
            .filter((v): v is number => typeof v === 'number');
        const maxPct = values.length > 0 ? Math.max(...values, 10) : 10;

        return (
            <div className="sw-commission-timeline">
                {points.map((p, i) => {
                    const prev = p.previous;
                    const cur = p.current;
                    const prevIsNull = prev === null;
                    const curIsNull = cur === null;
                    const delta = !prevIsNull && !curIsNull ? cur - prev : null;
                    let tone: 'up' | 'down' | 'flat' | 'meta' = 'meta';
                    if (delta !== null) {
                        if (delta > 0) tone = 'up';
                        else if (delta < 0) tone = 'down';
                        else tone = 'flat';
                    }

                    const curLabel = curIsNull
                        ? 'Not running Jito'
                        : cur + '%';
                    const prevLabel = prevIsNull
                        ? (kind === 'jito' ? 'Not running Jito' : 'N/A')
                        : prev + '%';

                    const dateStr = p.date
                        ? p.date.toLocaleDateString(undefined, { dateStyle: 'medium' })
                        : '—';
                    const timeStr = p.date ? p.date.toLocaleTimeString(undefined, { timeStyle: 'short' }) : '';

                    // Sparkline scale for the "new commission" row.
                    const scale = typeof cur === 'number' ? Math.max(2, (cur / maxPct) * 100) : 0;

                    return (
                        <div key={'change-' + i} className={'sw-commission-event sw-commission-event-' + tone}>
                            <div className="sw-commission-event-date">
                                <div className="sw-commission-event-day">{dateStr}</div>
                                <div className="sw-commission-event-time">{timeStr}</div>
                            </div>
                            <div className="sw-commission-event-change">
                                <span className="sw-commission-old">{prevLabel}</span>
                                <span className="sw-commission-arrow" aria-hidden="true">
                                    <i className="bi bi-arrow-right" />
                                </span>
                                <span className="sw-commission-new">{curLabel}</span>
                                {delta !== null ? (
                                    <span className={'sw-commission-delta sw-commission-delta-' + tone}>
                                        {delta > 0 ? '+' : delta < 0 ? '−' : ''}{Math.abs(delta).toFixed(delta % 1 === 0 ? 0 : 2)}%
                                    </span>
                                ) : null}
                            </div>
                            {typeof cur === 'number' ? (
                                <div className="sw-commission-bar" aria-hidden="true">
                                    <div className="sw-commission-bar-fill" style={{ width: scale + '%' }} />
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        );
    }

    renderCommissionTable() {
        return this.renderCommissionTimeline(this.state.commissionHistory || [], 'std');
    }

    renderJitoCommissionTable() {
        return this.renderCommissionTimeline(this.state.jitoCommissionHistory || [], 'jito');
    }

    render() {
        const alertFormRef = React.createRef()
        const scrollToAlertForm = () => (alertFormRef.current as HTMLElement).scrollIntoView()
        const solflareEnabled = checkSolflareEnabled(this.props.userPubkey);

        if(this.state.validator!=null) {

            let updated_at = new Date(this.state.validator.updated_at);

            let activated_stake = new Intl.NumberFormat().format(Number(this.state.validator.activated_stake.toFixed(0)));

            return ( [
                <div className='sw-profile-wrap' key='validator-details-redesigned-wrap'>
                <ProfileHeader
                    key='profileHeader'
                    validator={this.state.validator}
                    connected={this.props.connected}
                    onStake={() => this.setState({showStakeModal:true})}
                    onAlert={scrollToAlertForm}
                />
                <ProfileNav key='profileNav' tabs={[
                    { id: 'overview', label: 'Overview', icon: 'bi-house-door' },
                    { id: 'updates', label: 'Updates', icon: 'bi-megaphone' },
                    { id: 'performance', label: 'Performance', icon: 'bi-graph-up' },
                    { id: 'score', label: 'Wiz Score', icon: 'bi-award' },
                    { id: 'stake', label: 'Stake history', icon: 'bi-bar-chart-line' },
                    { id: 'commissions', label: 'Commissions', icon: 'bi-cash-coin' },
                    { id: 'alerts', label: 'Alerts', icon: 'bi-bell' }
                ]} />
                <div id='overview' className='sw-anchor' />
                <div id='updates' className='sw-anchor' />
                <ValidatorUpdates validator={this.state.validator} />
                </div>,
                <div className='container-sm m-1 position-relative d-flex align-items-center validator-detail-header sw-legacy-hidden' key='validator-details-header'>
                    
                   
                    <div className='d-flex flex-grow-1 flex-column validator-delinquency-container'>
                        <div className='d-flex flex-row validator-detail-name text-truncate '>
                            <RenderImage
                                img={this.state.validator.image}
                                vote_identity={this.state.validator.vote_identity}
                                size={50}
                                className={(this.state.validator.delinquent) ? 'border border-danger border-3' : ''}
                            />
                            <h4 className='d-flex align-items-center text-white ms-2 text-truncate mb-0'><RenderName validator={this.state.validator} /></h4>
                        </div>
                        <div className='d-flex flex-row delinquent-label'>
                            {(this.state.validator.delinquent) ? (
                                <div className='badge bg-danger ms-2'>
                                    <OverlayTrigger
                                        placement="bottom"
                                        overlay={
                                            <Tooltip>
                                                This validator is currently delinquent, which means they aren&apos;t voting.
                                            </Tooltip>
                                        } 
                                    > 
                                        <span>DELINQUENT</span>
                                    </OverlayTrigger>
                                </div>
                            ): null}
                        </div>
                    </div>
                    <div className='d-flex'>
                        <Gauges
                            skip_rate={this.state.validator.skip_rate}
                            credit_ratio={this.state.validator.credit_ratio}
                            wiz_score={this.state.validator.wiz_score}
                            uptime={this.state.validator.uptime}

                        />
                    </div>
                        
                        
                </div>,
                <div className='d-flex flex-column validator-details-content' key='validator-details-content'>
                    {(this.state.validator.admin_comment!==null) ?
                        <div className='d-flex p-1 border border-warning rounded m-2 text-light'>
                            <span className='fw-bold mx-2'>Admin Comment:</span> {this.state.validator.admin_comment}
                        </div>
                    : null }
                    <div className='d-flex flex-column p-2 text-white position-relative validator-detail-box m-1'>
                        
                        <div className='validator-detail-flex-opacity-bg'></div>
                        <div className='validator-buttons'>
                            <button className='btn btn-outline-light mx-1' onClick={scrollToAlertForm}>
                                + Create Alert
                            </button>
                            <ConditionalWrapper
                                    condition={(!this.props.connected) ? true : false}
                                    wrapper={children => (
                                        <OverlayTrigger
                                            placement="right"
                                            overlay={
                                                <Tooltip>
                                                    Connect wallet to enable
                                                </Tooltip>
                                            } 
                                        >
                                            {children}
                                        </OverlayTrigger>
                                    )}
                            >
                                <span>
                                    <button 
                                        className='btn btn-outline-light mx-1' 
                                        onClick={() => this.setState({showStakeModal:true})}
                                        disabled={!this.props.connected}
                                        >
                                        + Stake
                                    </button>
                                </span>
                            </ConditionalWrapper>
                        </div>
                            <div className='row'>
                                <div className='col'>
                                    <div className='row mb-2'>
                                        <div className='col col-md-2 fw-bold'>
                                            Description
                                        </div>
                                        <div className='col'>
                                            {this.state.validator.description}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className='row mobile-validator-info-row'>
                                <div className='col'>
                                    <div className='row mb-2'>
                                        <div className='col fw-bold'>
                                            Website
                                        </div>
                                        <div className='col text-truncate'>
                                            <RenderUrl
                                                url={this.state.validator.website}
                                            />
                                        </div>
                                    </div>
                                    
                                </div>  
                                <div className='col'>
                                    <div className='row mb-2'>
                                        <div className='col fw-bold'>
                                            Commission
                                        </div>
                                        <div className='col d-flex align-items-center'>
                                            {this.state.validator.commission} %
                                            {this.renderJitoCommissionLabel()}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className='col'>
                                    <div className='row mb-2'>
                                        <div className='col fw-bold'>
                                            
                                        </div>
                                        <div className='col'>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className='row  mobile-validator-info-row'>
                            <div className='col'>
                                    <div className='row'>
                                        <div className='col fw-bold'>
                                            TrueAPY (estimate)
                                            <OverlayTrigger
                                                placement="bottom"
                                                overlay={
                                                    <Tooltip>
                                                        Our TrueAPY is based on a 10-epoch median of both the true staking APY and Jito MEV APY (where applicable).
                                                    </Tooltip>
                                                } 
                                            >
                                                <i className='bi bi-info-circle ms-2'></i>
                                            </OverlayTrigger>
                                        </div>
                                        <div className='col'>
                                            <div className='sw-apy-cell'>
                                                <div className='sw-apy-total'>{this.state.validator.total_apy}%</div>
                                                <div className='sw-apy-breakdown'>
                                                    <OverlayTrigger
                                                        placement="top"
                                                        overlay={<Tooltip>10-epoch median native staking APY</Tooltip>}
                                                    >
                                                        <span className='sw-apy-part'>Staking <strong>{this.state.validator.staking_apy}%</strong></span>
                                                    </OverlayTrigger>
                                                    {(this.state.validator.is_jito) ?
                                                        <>
                                                            <span className='sw-apy-sep' aria-hidden='true'>·</span>
                                                            <OverlayTrigger
                                                                placement="top"
                                                                overlay={<Tooltip>10-epoch cluster-median Jito MEV APY</Tooltip>}
                                                            >
                                                                <span className='sw-apy-part sw-apy-part-mev'>MEV <strong>{this.state.validator.jito_apy}%</strong></span>
                                                            </OverlayTrigger>
                                                        </>
                                                        : null
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className='col'>
                                    <div className='row'>
                                        <div className='col fw-bold'>
                                            Stake
                                        </div>
                                        <div className='col d-flex align-items-center'>
                                            ◎ {activated_stake}
                                            <StakeLabel
                                                stake={(this.state.stake_change!==null) ? this.state.stake_change : 0}
                                                />
                                        </div>
                                    </div>
                                </div>
                                <div className='col'>
                                    <div className='row'>
                                        <div className='col fw-bold'>
                                            Version
                                        </div>
                                        <div className='col'>
                                            <div className='col d-flex align-items-center'>
                                                {this.state.validator.version}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            
                        
                    </div>


                    <div id='performance' className='sw-anchor' />
                    <div className='d-flex mb-1 flex-grow-1 flex-wrap validator-detail-flex-container'>
                        <div className='flex-grow-1 m-1 validator-detail-flex-card delinquency-flex-card'>
                            <div className='validator-detail-flex-opacity-bg'></div>
                            <div className='card text-light delinquency-card'>
                                <div className='card-header'>
                                    Uptime
                                </div>
                                <div className='card-body d-flex align-items-center delinquency-card-body'>
                                    <DelinquencyChart
                                        vote_identity={this.state.validator.vote_identity}
                                        first_epoch={this.state.validator.first_epoch_with_stake}
                                    />
                                </div>
                                
                            </div>
                        </div>
                        <div className='flex-grow-1 m-1 validator-detail-flex-card'>
                            <div className='validator-detail-flex-opacity-bg'></div>
                            <div className='card text-light'>
                                <div className='card-header'>
                                    24h Moving Average Wiz Score
                                </div>
                                <div className='card-body'>
                                    <WizScoreChart 
                                        vote_identity={this.state.validator.vote_identity}
                                    />
                                </div>
                            </div>
                        </div>
                        <div id='stake' className='sw-anchor' />
                        <div className='flex-grow-1 m-1 validator-detail-flex-card'>
                            <div className='validator-detail-flex-opacity-bg'></div>
                            <div className='card text-light'>
                                <div className='card-header'>
                                    Active Stake (30 epochs)
                                </div>
                                <div className='card-body'>
                                    <StakeHistoryChart
                                        vote_identity={this.state.validator.vote_identity}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='flex-grow-1 m-1 validator-detail-flex-card'>
                            <div className='validator-detail-flex-opacity-bg'></div>
                            <div className='card text-light'>
                                <div className='card-header'>
                                    Stake changes this epoch: 
                                    <StakeLabel
                                        stake={(this.state.stake_change!==null) ? this.state.stake_change : 0}
                                    />
                                </div>
                                <div className='card-body epoch-stake-chart-container'>
                                    <EpochStakeChart 
                                        vote_identity={this.state.validator.vote_identity}
                                        updateStake={(change) => this.updateStakeChange(change)}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='flex-grow-1 m-1 validator-detail-flex-card'>
                            <div className='validator-detail-flex-opacity-bg'></div>
                            <div className='card text-light'>
                                <div className='card-header'>
                                    Vote Success
                                    <OverlayTrigger
                                        placement="bottom"
                                        overlay={
                                            <Tooltip>
                                                Last 2000 observations of vote success rate taken during our Wiz Score snapshots, approximately every five minutes. Vote Success is the percentage of total elapsed slot in the epoch that the validator has voted on.
                                            </Tooltip>
                                        } 
                                    >
                                        <i className='bi bi-info-circle ms-2'></i>
                                    </OverlayTrigger>
                                </div>
                                <div className='card-body'>
                                    <VoteSuccessChart
                                        vote_identity={this.state.validator.vote_identity}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='flex-grow-1 m-1 validator-detail-flex-card'>
                            <div className='validator-detail-flex-opacity-bg'></div>
                            <div className='card text-light'>
                                <div className='card-header'>
                                    Skip Rate
                                    <OverlayTrigger
                                        placement="bottom"
                                        overlay={
                                            <Tooltip>
                                                Last 2000 observations of skip rate taken during our Wiz Score snapshots, approximately every five minutes
                                            </Tooltip>
                                        } 
                                    >
                                        <i className='bi bi-info-circle ms-2'></i>
                                    </OverlayTrigger>
                                </div>
                                <div className='card-body'>
                                    <SkipRateChart
                                        vote_identity={this.state.validator.vote_identity}
                                    />
                                </div>
                            </div>
                        </div>
                        <div id='score' className='sw-anchor' />
                        <div className='flex-grow-1 m-1 validator-detail-flex-card'>
                            <div className='validator-detail-flex-opacity-bg'></div>
                            <div className='card text-light'>
                                <div className='card-header'>
                                    Scorecard
                                </div>
                                <div className='card-body validator-detail-scorecard'>
                                    <WizScoreBody
                                    validator={this.state.validator}
                                />
                                </div>
                            </div>
                        </div>
                        <div id='commissions' className='sw-anchor' />
                        <div className='flex-grow-1 m-1 validator-detail-flex-card'>
                            <div className='validator-detail-flex-opacity-bg'></div>
                            <div className='card text-light'>
                                <div className='card-header'>
                                    Commission History
                                </div>
                                <div className='card-body'>
                                    {this.renderCommissionTable()}
                                </div>
                            </div>
                            <div className='card text-light'>
                                <div className='card-header'>
                                    Jito MEV Commission History
                                </div>
                                <div className='card-body'>
                                    {this.renderJitoCommissionTable()}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id='alerts' className='sw-anchor' />
                    <div className='row'>
                        <div ref={alertFormRef as React.RefObject<HTMLDivElement>} className='col p-2 text-white border border-white rounded'>
                            <AlertForm
                                validator={this.state.validator}
                                hideAlertModal={null}
                                userPubkey={this.props.userPubkey}
                                solflareEnabled={this.props.solflareEnabled}
                            />
                        </div>
                    </div>
                    <div className='text-secondary fst-italic text-end my-1'>
                        Updated: {updated_at.toLocaleString()}
                    </div>
                </div>,
                <StakeDialog
                    key='stakeModal'
                    validator={this.state.validator}
                    showStakeModal={this.state.showStakeModal}
                    hideStakeModal={() => this.setState({showStakeModal:false})}
                    clusterStats={this.state.clusterStats}
                />
            ]
            )
        }
        else {
            return (
                <Spinner />
            )
        }
    }
}

export {ValidatorDetail}