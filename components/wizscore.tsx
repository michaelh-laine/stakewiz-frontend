import React from 'react';
import config from '../config.json';
import { Modal, Button, Overlay, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Link from 'next/link';
import axios from 'axios';
import {Chart} from 'react-google-charts'
import {Spinner} from './common'
import { validatorI } from './validator/interfaces';
import * as browser from 'lib/browser';
import WizEmblem from '../public/images/emblem.svg'
import ordinal from 'ordinal';

const API_URL = process.env.API_BASE_URL;

interface ScorecardRow {
    label: string;
    tooltip: string;
    value: string;
    score: number | string;
    addPercent?: boolean;
    threshold?: number;
    color?: 'green' | 'red';
    inverse?: boolean;
    sign?: '+' | '-' | '';
}

const ScorecardItem: React.FC<ScorecardRow> = (props) => {
    // Tone rules mirror the original WizScoreRow logic
    let tone: 'positive' | 'negative' | 'neutral' = 'neutral';
    const t = typeof props.threshold === 'number' ? props.threshold : 0;
    const numericScore = typeof props.score === 'number' ? props.score : NaN;
    if (props.color === 'green') {
        if (props.inverse) tone = numericScore < t ? 'positive' : 'neutral';
        else tone = numericScore > t ? 'positive' : 'neutral';
    } else if (props.color === 'red') {
        if (props.inverse) tone = numericScore < t ? 'negative' : 'neutral';
        else tone = numericScore > t ? 'negative' : 'neutral';
    }

    let scoreDisplay: string;
    if (typeof props.score === 'number') {
        const abs = Math.abs(props.score);
        const rendered = props.addPercent ? abs + '%' : String(abs);
        if (props.score === 0) scoreDisplay = props.addPercent ? '0%' : '0';
        else if (props.score < 0) scoreDisplay = '−' + rendered;
        else scoreDisplay = (props.sign || '+') + rendered;
    } else {
        scoreDisplay = props.score;
    }

    return (
        <div className={'sw-scorecard-row sw-scorecard-tone-' + tone}>
            <div className="sw-scorecard-label">
                <span className="sw-scorecard-label-text">{props.label}</span>
                <OverlayTrigger placement="top" overlay={<Tooltip>{props.tooltip}</Tooltip>}>
                    <button type="button" className="sw-scorecard-info" aria-label="More info">
                        <i className="bi bi-info-circle" />
                    </button>
                </OverlayTrigger>
            </div>
            <div className="sw-scorecard-value">{props.value}</div>
            <div className="sw-scorecard-score">{scoreDisplay}</div>
        </div>
    );
};

class WizScoreBody extends React.Component<{
    validator: validatorI;
},
{}> {
    
    renderInfoCount() {
        return (this.props.validator.info_score / 2)
    }

    renderWithdrawAuthorityValue() {
        if(this.props.validator.withdraw_authority_score==0) {
            return 'Differs from validator identity (good)';
        }
        else {
            return 'Set to validator identity (security risk)';
        }
    }

    renderSuperminorityValue() {
        if(this.props.validator.superminority_penalty==0) {
            return 'Below superminority	';
        }
        else {
            return 'In the superminority';
        }
    }

    renderCommissionAlert() {
        if(this.props.validator.commission>10) {
            return (
                <div className="bg-danger text-white p-2 m-2 text-center">
                    Validator&apos;s commission is above 10%. We override their score to 0%.
                </div>
            );
        }
        else return null;
    }

    renderNoVotingAlert() {
        if(this.props.validator.no_voting_override) {
            return (
                <div className="bg-danger text-white p-2 m-2 text-center">
                    Validator hasn&apos;t voted this epoch. We override their score to 0%.
                </div>
            );
        }
        else return null;
    }

    renderTPUIPAlert() {
        if(this.props.validator.tpu_ip_concentration>0) {
            return (
                <div className="bg-warning text-white p-2 m-2 text-center">
                    Validator is using a shared TPU IP or TPU relayer (e.g. Jito relayer).
                </div>
            );
        }
        else return null;
    }

    renderWizScore() {
        let color = 'text-danger';
        if(this.props.validator.rank <= config.WIZ_SCORE_RANK_GROUPS.TOP) {
            color = 'text-success';
        }
        else if(this.props.validator.rank <= config.WIZ_SCORE_RANK_GROUPS.MEDIUM) {
            color = 'text-warning';
        }
        return (
            <div className="d-flex flex-grow-1 justify-content-center text-center text-white mx-5 p-3 text-italic scorecard-wiz-score align-items-center ms-2">
                    
                        <div className={'me-2 '}><WizEmblem fill="#16102e" width="40px" height="40px" /> Score</div> 
                        <div>
                            <span id="scorecard-wizscore">
                            {' '+new Intl.NumberFormat().format(Number(this.props.validator.wiz_score.toFixed(2)))+'% '}
                            </span> 
                            ( 
                                <span id="scorecard-wizrank">
                                    {ordinal(this.props.validator.rank)}
                                </span>
                                )
                        </div>
                    
                
            </div>
        );
    }

    getRows(): ScorecardRow[] {
        const v = this.props.validator;
        return [
            { label: 'Vote Success', tooltip: 'Ratio of credits vs slots completed this epoch.',
              value: v.vote_success + '%', score: v.vote_success_score, addPercent: true, threshold: 0, color: 'green', sign: '+' },
            { label: 'Slot Skip Rate', tooltip: 'Percentage of leader slots in which this validator failed to produce a block. Score is ignored for low-staked validators.',
              value: new Intl.NumberFormat().format(Number(v.skip_rate.toFixed(1))) + '%', score: v.skip_rate_score, addPercent: true, threshold: 0, color: 'green', sign: '+' },
            { label: 'Skip rate ignored', tooltip: "Skip rate is ignored if validator's stake is below a threshold (see FAQ).",
              value: v.skip_rate_ignored ? 'Yes' : 'No', score: v.skip_rate_ignored ? 'scaled up' : 'N/A', addPercent: false, threshold: 0, color: 'green', sign: '' },
            { label: 'Published Information', tooltip: '2.5% for each of these: name, logo, description & website.',
              value: this.renderInfoCount() + ' out of 5', score: v.info_score, addPercent: true, threshold: 0, color: 'green', sign: '+' },
            { label: 'Commission', tooltip: 'Up to +5% score for commission of 0%. No score for 10% commission and above.',
              value: v.commission + '%', score: v.commission_score, addPercent: true, threshold: 0, color: 'green', sign: '+' },
            { label: 'Operating History', tooltip: 'Up to +10% for having at least 10 epoch history (counted from first epoch with stake).',
              value: v.first_epoch_distance + ' epochs', score: v.epoch_distance_score, addPercent: true, threshold: 0, color: 'green', sign: '+' },
            { label: 'Stake Weight', tooltip: "Up to +15%, 0% for any stake that is >= 10% of the largest validator's stake.",
              value: v.stake_weight + '%', score: v.stake_weight_score, addPercent: true, threshold: 0, color: 'green', sign: '+' },
            { label: 'Withdraw Authority', tooltip: "Having the vote account withdraw authority set to the validator's identity keypair is a bad security practice and incurs a -20% penalty.",
              value: this.renderWithdrawAuthorityValue(), score: v.withdraw_authority_score, addPercent: true, threshold: 0, color: 'red', inverse: true },
            { label: 'ASN Concentration', tooltip: 'Stake concentration by ASN (ASN can comprise multiple physical locations). Penalty applied relative to the highest-staked ASN (which incurs the max penalty).',
              value: v.asn_concentration + '%', score: v.asn_concentration_score, addPercent: true, threshold: 0, color: 'red', inverse: true },
            { label: 'City Concentration', tooltip: 'Stake concentration by City (city can comprise multiple data centres). Penalty applied relative to the highest-staked city (which incurs the max penalty).',
              value: v.city_concentration + '%', score: v.city_concentration_score, addPercent: true, threshold: 0, color: 'red', inverse: true },
            { label: 'ASN + City Concentration', tooltip: 'Combined concentration by ASN and city. Penalty applied relative to the highest-staked combo (which incurs the max penalty).',
              value: v.asncity_concentration + '%', score: v.asncity_concentration_score, addPercent: true, threshold: 0, color: 'red', inverse: true },
            { label: 'TPU IP Concentration', tooltip: 'Stake concentration by TPU IP. Penalty applied relative to the highest-staked TPU IP (which incurs the max penalty). A penalty here implies the validator may be using a shared relayer instead of running their own.',
              value: v.tpu_ip_concentration + '%', score: v.tpu_ip_concentration_score, addPercent: true, threshold: 0, color: 'red', inverse: true },
            { label: 'Uptime (30 days)', tooltip: 'Percentage of time a validator was not delinquent over the past 30 days (or since the validator was added to our database if less than 30 days).',
              value: v.uptime + '%', score: v.uptime_score, addPercent: true, threshold: 0, color: 'green', sign: '+' },
            { label: 'Version Penalty', tooltip: 'A penalty is applied for running an outdated or not recommended software version.',
              value: v.version || '—', score: v.invalid_version_score, addPercent: true, threshold: 0, color: 'red', inverse: true },
            { label: 'Superminority Penalty', tooltip: 'A penalty is applied to validators in the superminority (highest 33.3% of stake weight).',
              value: this.renderSuperminorityValue(), score: v.superminority_penalty, addPercent: true, threshold: 0, color: 'red', inverse: true }
        ];
    }

    renderBody() {
        const v = this.props.validator;
        const rows = this.getRows();

        return (
            <div className="sw-scorecard">
                <p className="sw-scorecard-intro">
                    This score helps you pick good validators to stake with. It rewards behaviour that
                    benefits the network and penalizes centralization. Weightings are versioned — this
                    validator&rsquo;s score uses version <strong>{v.score_version}</strong>.{' '}
                    <Link href="/faq#faq-wizscore" passHref target="_new">Learn how the score is computed.</Link>
                </p>

                <div className="sw-scorecard-list" role="list">
                    <div className="sw-scorecard-head" aria-hidden="true">
                        <span>Category</span>
                        <span>Value</span>
                        <span>Score</span>
                    </div>
                    {rows.map(r => <ScorecardItem key={r.label} {...r} />)}
                </div>

                {this.renderCommissionAlert()}
                {this.renderNoVotingAlert()}
                {this.renderTPUIPAlert()}

                <div className="sw-scorecard-total">
                    <div className="sw-scorecard-total-label">
                        <WizEmblem fill="currentColor" width="28px" height="28px" />
                        <span>Total Wiz Score</span>
                    </div>
                    <div className="sw-scorecard-total-value">
                        {new Intl.NumberFormat().format(Number(v.wiz_score.toFixed(2)))}%
                    </div>
                    <div className="sw-scorecard-total-rank">Ranked {ordinal(v.rank)}</div>
                </div>
            </div>
        );
    }

    render() {
        return this.renderBody();
    }
}

class WizScore extends React.Component<{
    validator: validatorI;
    showWizModal: boolean;
    hideWizModal: Function;
},
{}> {
    renderName() {
        
        if(this.props.validator!=null) {
            return this.props.validator.name;
        }
        else {
            return 'Validator Not Chosen';
        }
    }

    renderWizScoreBody() {
        if(this.props.validator!=null) {
            return <WizScoreBody validator={this.props.validator} />
        }
        else {
            return null;
        }
    }
    
    render() {
        return (
            <Modal show={this.props.showWizModal} onHide={() => this.props.hideWizModal()} dialogClassName='modal-lg scorecard-modal'>
                <Modal.Header closeButton>
                    <Modal.Title>{this.renderName()}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {this.renderWizScoreBody()}
                </Modal.Body>
            </Modal>
        );
        }
}

class WizScoreWeightings extends React.Component<{},
{
    weightings: any[any];
    hasData: boolean;
}> {
    constructor(props) {
        super(props);
        this.state = {
            weightings: undefined,
            hasData: false
        };
        if(this.state.weightings==undefined) this.getWeightings();
    }

    getWeightings() {
        axios(API_URL+config.API_ENDPOINTS.weightings, {
            headers: {'Content-Type':'application/json'}
        })
            .then(response => {
            let json = response.data;
            
            this.setState({
                weightings: json,
                hasData: true
                });
            })
            .catch(e => {
            console.log(e);
            setTimeout(() => { this.getWeightings() }, 5000);
            })
    }

    render() {
        if(this.state.hasData) {
            return (
                [
                    <p key='wiz-weighting-paragraph'>
                        The Wiz Score consists of many metrics which are given different weightings. We revise these from time to time and assign them a version number. The current score (for which the details are shown below) is version {this.state.weightings.score_version}.
                    </p>,
                    <table className="table table-sm text-white table-dark" key='wiz-weighting-table'> 
                        <thead> 
                            <tr>
                                <th scope="col">
                                    Parameter
                                </th>
                                <th scope="col">
                                    Value 
                                </th>
                                <th scope="col">
                                    Comment
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr> 
                                <td>
                                    Vote Success Weight 
                                </td>
                                <td>
                                    {this.state.weightings.vote_success_weight}
                                </td>
                                <td>
                                    The weighting given to validator&apos;s voting success.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Skip rate weight 
                                </td>
                                <td>
                                    {this.state.weightings.skip_rate_weight}
                                </td>
                                <td>
                                    The weighting given to validator&apos;s skip rate.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Skip rate cutoff multiplier 
                                </td>
                                <td>
                                    {this.state.weightings.skip_rate_cutoff_multiplier}
                                </td>
                                <td>
                                    Cluster average * this multiplier gives us the value which has a 0 score. If the average skip rate is 5% and the multiplier is 2, then a 10% skip rate or above will have a score of 0, and anything below 10% will have a score higher than 0.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Skip rate min stake
                                </td>
                                <td className='text-nowrap'>
                                    ◎ {this.state.weightings.skip_rate_min_stake}
                                </td>
                                <td>
                                    For validators with less than this amount of activated stake we ignore the skip rate. The remaining score is scaled up by the skip rate weight to achieve a score out of 100%. This is because skip rate is highly variable and for validators with low stake and few leader slots it can lead to extremely high variance that it not necessarily reflective of the quality of the node&apos;s operation.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Min valid version 
                                </td>
                                <td>
                                    {this.state.weightings.min_versions.map((v, i, arr) => {
                                        if(arr.length-1===i) {
                                            return v;
                                        }
                                        else {
                                            return v+', ';
                                        }
                                    })}
                                </td>
                                <td>
                                    The minimum version within each minor release branch a validator should be using, e.g. if the value here is 1.9.20 the validator can use 1.9.20, 1.9.21, 1.9.22, etc., but not 1.9.19 or 1.8.30. Multiple minor branches can be valid at the same time.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Invalid version penalty
                                </td>
                                <td>
                                   {this.state.weightings.invalid_version_penalty}
                                </td>
                                <td>
                                    Penalty for invalid version 
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Info weight
                                </td>
                                <td>
                                    {this.state.weightings.info_weight}
                                </td>
                                <td>
                                    The total weight of validator info (broken up into 4 equally weighted components for name, logo, website and description).
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Maximum commission
                                </td>
                                <td>
                                    {this.state.weightings.max_commission}
                                </td>
                                <td>
                                    The commission that gets a 0 score, anything below this value has a score &gt; 0 up to the max commission weight (i.e. 0% commission gets 100% which earns the full commission weight)
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Commission weight
                                </td>
                                <td>
                                    {this.state.weightings.commission_weight}
                                </td>
                                <td>
                                    The weight of the commission score.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Epoch max distance 
                                </td>
                                <td>
                                    {this.state.weightings.epoch_distance_max}
                                </td>
                                <td>
                                    The number of epochs with stake a validator should have to get the highest operational history score.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Epoch distance weight 
                                </td>
                                <td>
                                    {this.state.weightings.epoch_distance_weight}
                                </td>
                                <td>
                                    The weighting given to validator&apos;s operational history.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Stake weight threshold 
                                </td>
                                <td>
                                    {this.state.weightings.stake_weight_threshold}
                                </td>
                                <td>
                                    Percentage of the largest validator&apos;s stake that is the cut off where we assign 0% score for stake weight. E.g. if largest validator has 15m SOL staked and the threshold is 0.1 all validators &gt;=1.5m stake will get a 0 score.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Stake weight weight 
                                </td>
                                <td>
                                    {this.state.weightings.stake_weight_weight}
                                </td>
                                <td>
                                    The weighting given to validator&apos;s stake. We give the highest score to the median stake weight (as of score version 67, prior to that we used the average), with a linear drop off below to 0 and above to the threshold value.
                                    <br /><br />If the median stake is 200,000 SOL a validator with 100,000 stake will earn 50% of the stake weight weight. A validator with 500,000 SOL stake will earn (500,000 - 200,000) / (1,500,000 - 200,000) * stake weight weight.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Withdraw authority penalty 
                                </td>
                                <td>
                                    {this.state.weightings.withdraw_authority_penalty}
                                </td>
                                <td>
                                    The penalty for validators with an unsafe withdraw authority (i.e. set to their validator identity).
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    ASN Concentration Weight 
                                </td>
                                <td>
                                    {this.state.weightings.asn_concentration_weight}
                                </td>
                                <td>
                                    The weighting given to validator&apos;s ASN stake concentration.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    City Concentration Weight 
                                </td>
                                <td>
                                    {this.state.weightings.city_concentration_weight}
                                </td>
                                <td>
                                    The weighting given to validator&apos;s city stake concentration.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    ASN+City Concentration Weight 
                                </td>
                                <td>
                                    {this.state.weightings.asn_city_concentration_weight}
                                </td>
                                <td>
                                    The weighting given to validator&apos;s ASN + city combined stake concentration.
                                </td>
                            </tr>
                            
                            <tr> 
                                <td>
                                    TPU IP Concentration Weight
                                </td>
                                <td>
                                    {this.state.weightings.tpu_ip_concentration_weight}
                                </td>
                                <td>
                                    The weighting given to validator&apos;s TPU IP stake concentration. This penalizes validators who use shared relayers.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Uptime Weight 
                                </td>
                                <td>
                                    {this.state.weightings.uptime_weight}
                                </td>
                                <td>
                                    The weighting given to validator&apos;s uptime over the past 30 days (or max period available if less than 30 days).
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Uptime cutoff 
                                </td>
                                <td>
                                    {this.state.weightings.uptime_cutoff}
                                </td>
                                <td>
                                    Threshold below which uptime has a score of 0, the uptime score is scaled linearly between this value and 100%.
                                </td>
                            </tr>
                            <tr> 
                                <td>
                                    Superminority Penalty 
                                </td>
                                <td>
                                    {this.state.weightings.superminority_penalty}
                                </td>
                                <td>
                                    The penalty given to validators in the superminority (top 33.3% of stake weight).
                                </td>
                            </tr>
                        </tbody>
                    </table>
                ]
            )
        }
        else {
            return (
                <p>Loading...</p>
            )
        }
    }
}

class WizScoreChart extends React.Component<{
    vote_identity: string;
},{
    wiz_scores: any[]
}> {
    constructor(props) {
        super(props);
        this.state = {
            wiz_scores: null
        };
        if(this.state.wiz_scores==null) this.getWizScores(this.props.vote_identity);
    }    

    getWizScores(vote_identity) {
        axios(API_URL+config.API_ENDPOINTS.validator_wiz_scores+"/"+vote_identity, {
          headers: {'Content-Type':'application/json'}
        })
          .then(response => {
            let json = response.data;
            
            let wiz_scores = [];
            wiz_scores.push(['Time', 'Wiz Score']);

            let isSafari:boolean = browser.check('Safari');

            for(var i in json) {
                if(isSafari){
                    let timeZone = json[i].created_at.slice(-3)+':00';
                    wiz_scores.push([new Date(json[i].created_at.substring(0, 19).replace(/-/g, "/")+timeZone), parseFloat(json[i].avg_wiz_score)]);
                }else{                
                    wiz_scores.push([new Date(json[i].created_at), parseFloat(json[i].avg_wiz_score)]);
                }
            }

            this.setState({
                wiz_scores: wiz_scores
            });
          })
          .catch(e => {
            console.log(e);
            setTimeout(() => { this.getWizScores(vote_identity) }, 5000);
          })
      }

    render() {
        if(this.state.wiz_scores==null) {
            return (
                <Spinner />
            )
        }
        else {
            return (
                <div className="sw-chart-wrap">
                    <Chart
                        chartType='LineChart'
                        width="100%"
                        height="260px"
                        data={this.state.wiz_scores}
                        options={{
                            backgroundColor: 'transparent',
                            curveType: 'function',
                            colors: ['#5907e6'],
                            lineWidth: 2,
                            legend: { position: 'none' },
                            interpolateNulls: true,
                            vAxis: {
                                gridlines: { color: 'rgba(22, 16, 53, 0.08)', count: 5 },
                                minorGridlines: { color: 'transparent' },
                                textStyle: { color: '#6f6a85', fontSize: 11, fontName: 'system-ui, sans-serif' },
                                format: 'percent',
                                baselineColor: 'rgba(22, 16, 53, 0.08)'
                            },
                            hAxis: {
                                gridlines: { color: 'transparent' },
                                minorGridlines: { color: 'transparent' },
                                textStyle: { color: '#6f6a85', fontSize: 11, fontName: 'system-ui, sans-serif' },
                                baselineColor: 'rgba(22, 16, 53, 0.08)'
                            },
                            trendlines: {
                                0: { color: '#d97706', type: 'exponential', lineWidth: 2, opacity: 0.85 }
                            },
                            chartArea: { top: 16, left: 52, right: 16, bottom: 32 }
                        }}
                    />
                </div>
            )
        }
    };
}

export {WizScore, WizScoreBody, WizScoreWeightings, WizScoreChart}