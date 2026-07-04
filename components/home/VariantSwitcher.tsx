import React, { FC } from 'react';

export type HomeVariant = 'curated' | 'dashboard' | 'guided';

export const VARIANT_DESCRIPTIONS: Record<HomeVariant, { name: string; tagline: string }> = {
    curated: { name: 'Curated', tagline: 'Hero & top picks · Best for newcomers' },
    dashboard: { name: 'Pro Dashboard', tagline: 'Network metrics at a glance' },
    guided: { name: 'Guided', tagline: 'Tell us what matters, we filter the list' }
};

const VariantSwitcher: FC<{ variant: HomeVariant; onChange: (v: HomeVariant) => void }> = ({ variant, onChange }) => (
    <div className="sw-variant-switcher" role="tablist" aria-label="Homepage layout">
        <span className="sw-variant-label">Layout</span>
        {(Object.keys(VARIANT_DESCRIPTIONS) as HomeVariant[]).map(v => (
            <button
                key={v}
                role="tab"
                aria-selected={variant === v}
                type="button"
                className={'sw-variant-btn' + (variant === v ? ' sw-variant-btn-active' : '')}
                onClick={() => onChange(v)}
                title={VARIANT_DESCRIPTIONS[v].tagline}
            >
                {VARIANT_DESCRIPTIONS[v].name}
            </button>
        ))}
    </div>
);

export default VariantSwitcher;
