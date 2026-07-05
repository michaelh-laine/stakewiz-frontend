import React, { FC, useEffect, useState } from 'react';

export interface ProfileTab {
    id: string;
    label: string;
    icon: string;
}

export const DEFAULT_TABS: ProfileTab[] = [
    { id: 'overview', label: 'Overview', icon: 'bi-house-door' },
    { id: 'performance', label: 'Performance', icon: 'bi-graph-up' },
    { id: 'score', label: 'Wiz Score', icon: 'bi-award' },
    { id: 'stake', label: 'Stake history', icon: 'bi-bar-chart-line' },
    { id: 'commissions', label: 'Commissions', icon: 'bi-cash-coin' },
    { id: 'alerts', label: 'Alerts', icon: 'bi-bell' }
];

const ProfileNav: FC<{ tabs?: ProfileTab[] }> = ({ tabs = DEFAULT_TABS }) => {
    const [active, setActive] = useState<string>(tabs[0].id);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setActive(entry.target.id);
                    }
                });
            },
            { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
        );
        tabs.forEach(t => {
            const el = document.getElementById(t.id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [tabs]);

    const handleClick = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (el) {
            const y = el.getBoundingClientRect().top + window.pageYOffset - 90;
            window.scrollTo({ top: y, behavior: 'smooth' });
            setActive(id);
        }
    };

    return (
        <nav className="sw-profile-nav" aria-label="Profile sections">
            <div className="sw-profile-nav-inner">
                {tabs.map(t => (
                    <a
                        key={t.id}
                        href={'#' + t.id}
                        className={'sw-profile-tab' + (active === t.id ? ' sw-profile-tab-active' : '')}
                        onClick={e => handleClick(e, t.id)}
                    >
                        <i className={'bi ' + t.icon + ' me-2'} />
                        <span>{t.label}</span>
                    </a>
                ))}
            </div>
        </nav>
    );
};

export default ProfileNav;
