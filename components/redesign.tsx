import React from 'react';
import { clusterStatsI, validatorI } from './validator/interfaces';

type ConceptKey = 'institutional' | 'operator' | 'analyst';

const concepts: Record<ConceptKey, {title:string; subtitle:string; pills:string[]}> = {
  institutional: {
    title: 'Concept 1 · Institutional Command Center',
    subtitle: 'Executive-first summary with big KPIs and direct validator discovery.',
    pills: ['Hero KPI rail', 'Curated validator highlights', 'Fast action search']
  },
  operator: {
    title: 'Concept 2 · Operator Workbench',
    subtitle: 'Dense operational context with graph-driven panels and warning surfaces.',
    pills: ['Ops signal cards', 'Expanded filters', 'Publishing-ready modules']
  },
  analyst: {
    title: 'Concept 3 · Research Terminal',
    subtitle: 'Comparison-forward hierarchy for delegators and validator analysts.',
    pills: ['Trend snapshots', 'Segment filters', 'Portfolio simulation hooks']
  }
};

export function RedesignShowcase({concept,setConcept,clusterStats,validators}:{concept:ConceptKey;setConcept:(concept:ConceptKey)=>void;clusterStats:clusterStatsI;validators:validatorI[]}) {
  const topValidators = [...validators].sort((a,b)=>b.wiz_score-a.wiz_score).slice(0,3);
  const c = concepts[concept];
  return <section className='sol-shell mb-3'>
    <div className='d-flex flex-wrap justify-content-between align-items-start gap-3'>
      <div>
        <h2 className='sol-heading mb-1'>Stakewiz × SOL Strategies Redesign</h2>
        <div className='text-secondary'>{c.title}</div>
        <p className='mb-2 text-light'>{c.subtitle}</p>
        <div className='d-flex flex-wrap gap-2'>
          {c.pills.map((pill)=><span key={pill} className='sol-pill'>{pill}</span>)}
        </div>
      </div>
      <div className='btn-group'>
        <button className={'btn btn-sm '+(concept==='institutional'?'btn-primary':'btn-outline-light')} onClick={()=>setConcept('institutional')}>Institutional</button>
        <button className={'btn btn-sm '+(concept==='operator'?'btn-primary':'btn-outline-light')} onClick={()=>setConcept('operator')}>Operator</button>
        <button className={'btn btn-sm '+(concept==='analyst'?'btn-primary':'btn-outline-light')} onClick={()=>setConcept('analyst')}>Analyst</button>
      </div>
    </div>
    <div className='row g-2 mt-1'>
      <div className='col-md-3'><div className='sol-card'><div className='sol-kpi'>◎ {Math.round(clusterStats.avg_activated_stake).toLocaleString()}</div><small>Avg Activated Stake</small></div></div>
      <div className='col-md-3'><div className='sol-card'><div className='sol-kpi'>◎ {Math.round(clusterStats.median_stake).toLocaleString()}</div><small>Median Stake</small></div></div>
      <div className='col-md-3'><div className='sol-card'><div className='sol-kpi'>{clusterStats.avg_apy.toFixed(2)}%</div><small>Average APY</small></div></div>
      <div className='col-md-3'><div className='sol-card'><div className='sol-kpi'>{clusterStats.avg_skip_rate.toFixed(2)}%</div><small>Average Skip Rate</small></div></div>
    </div>
    <div className='mt-2'>
      <small className='text-uppercase text-secondary'>Top validators by Wiz score</small>
      <div className='d-flex flex-wrap gap-2 mt-1'>
        {topValidators.map((v)=><div key={v.vote_identity} className='sol-pill'>{v.name || v.vote_identity.slice(0,8)} · {v.wiz_score}%</div>)}
      </div>
    </div>
  </section>
}
