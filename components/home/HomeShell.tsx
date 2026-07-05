import React, { FC, useEffect, useState } from 'react';
import Hero from './Hero';
import Highlights from './Highlights';
import HomeDashboard from './HomeDashboard';
import HomeWizard, { WizardPreset } from './HomeWizard';
import VariantSwitcher, { HomeVariant } from './VariantSwitcher';
import WelcomeBack from './WelcomeBack';
import RecentlyViewed from './RecentlyViewed';
import { clusterStatsI, EpochInfoI, validatorI } from '../validator/interfaces';
import { getEpochInfo } from '../common';

const STORAGE_KEY = 'stakewiz.homeVariant';

export interface HomeShellChildProps {
    preset: WizardPreset;
}

const HomeShell: FC<{
    validators: validatorI[] | null;
    clusterStats: clusterStatsI | null;
    userPubkey: string | null;
    walletValidators: string[] | null;
    children: (props: HomeShellChildProps) => React.ReactNode;
}> = ({ validators, clusterStats, userPubkey, walletValidators, children }) => {
    const [variant, setVariant] = useState<HomeVariant>('curated');
    const [epochInfo, setEpochInfo] = useState<EpochInfoI | null>(null);
    const [preset, setPreset] = useState<WizardPreset>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const fromUrl = params.get('v') as HomeVariant | null;
        if (fromUrl && ['curated', 'dashboard', 'guided'].includes(fromUrl)) {
            setVariant(fromUrl);
            return;
        }
        const stored = window.localStorage.getItem(STORAGE_KEY) as HomeVariant | null;
        if (stored && ['curated', 'dashboard', 'guided'].includes(stored)) {
            setVariant(stored);
        }
    }, []);

    useEffect(() => {
        getEpochInfo().then((info: EpochInfoI) => setEpochInfo(info)).catch(() => {});
    }, []);

    const handleVariantChange = (next: HomeVariant) => {
        setVariant(next);
        if (typeof window !== 'undefined') {
            try { window.localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
            const url = new URL(window.location.href);
            url.searchParams.set('v', next);
            window.history.replaceState({}, '', url.toString());
        }
        if (next !== 'guided') setPreset(null);
    };

    const scrollToList = () => {
        const el = document.getElementById('vlist-search');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="sw-home">
            <div className="sw-home-top">
                <VariantSwitcher variant={variant} onChange={handleVariantChange} />
            </div>

            <WelcomeBack userPubkey={userPubkey} walletValidators={walletValidators} validators={validators} />

            {variant === 'curated' ? (
                <>
                    <Hero
                        validators={validators}
                        clusterStats={clusterStats}
                        epochInfo={epochInfo}
                        onScrollToList={scrollToList}
                        onOpenAdvanced={() => handleVariantChange('guided')}
                    />
                    <RecentlyViewed validators={validators} />
                    <Highlights validators={validators} />
                </>
            ) : null}
            {variant === 'dashboard' ? (
                <>
                    <HomeDashboard validators={validators} clusterStats={clusterStats} epochInfo={epochInfo} />
                    <RecentlyViewed validators={validators} />
                </>
            ) : null}
            {variant === 'guided' ? (
                <>
                    <HomeWizard
                        validators={validators}
                        clusterStats={clusterStats}
                        selectedPreset={preset}
                        onSelectPreset={setPreset}
                    />
                    <RecentlyViewed validators={validators} />
                </>
            ) : null}
            <div className="sw-home-list">{children({ preset })}</div>
        </div>
    );
};

export default HomeShell;
