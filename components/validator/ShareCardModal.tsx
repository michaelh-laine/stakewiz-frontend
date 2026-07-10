import React, { FC, useEffect, useRef, useState } from 'react';
import { Modal } from 'react-bootstrap';
import ordinal from 'ordinal';
import { validatorI } from './interfaces';

interface ShareCardModalProps {
    show: boolean;
    onHide: () => void;
    validator: validatorI;
}

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
};

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
    new Promise(resolve => {
        if (!src) { resolve(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });

const drawCard = async (canvas: HTMLCanvasElement, validator: validatorI) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    // Base gradient
    const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    bg.addColorStop(0, '#f5f4f8');
    bg.addColorStop(0.5, '#ffffff');
    bg.addColorStop(1, '#f5f4f8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Radial glow accents
    const glow1 = ctx.createRadialGradient(180, 100, 0, 180, 100, 500);
    glow1.addColorStop(0, 'rgba(124, 126, 225, 0.18)');
    glow1.addColorStop(1, 'rgba(124, 126, 225, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    const glow2 = ctx.createRadialGradient(1050, 550, 0, 1050, 550, 500);
    glow2.addColorStop(0, 'rgba(89, 7, 230, 0.10)');
    glow2.addColorStop(1, 'rgba(89, 7, 230, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Brand ribbon (top)
    ctx.fillStyle = '#5907e6';
    ctx.font = '600 22px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('STAKEWIZ · SOLANA VALIDATOR PROFILE', 60, 50);

    // Logo circle placeholder
    const logoSize = 160;
    const logoX = 60;
    const logoY = 130;
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#efedf6';
    ctx.fillRect(logoX, logoY, logoSize, logoSize);
    const logo = await loadImage(validator.image || '/images/validator-image-na.png');
    if (logo) {
        ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    } else {
        ctx.fillStyle = '#5907e6';
        ctx.font = '700 60px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const initials = (validator.name || 'SOL').slice(0, 2).toUpperCase();
        ctx.fillText(initials, logoX + logoSize / 2, logoY + logoSize / 2);
        ctx.textAlign = 'start';
    }
    ctx.restore();

    // Logo border ring
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = validator.delinquent ? '#d92638' : '#5907e6';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Name
    ctx.fillStyle = '#16102e';
    ctx.font = '700 68px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textBaseline = 'top';
    const displayName = (validator.name && validator.name.length > 0) ? validator.name : validator.vote_identity.slice(0, 12) + '…';
    ctx.fillText(displayName.length > 28 ? displayName.slice(0, 27) + '…' : displayName, 250, 145);

    // Rank + Wiz score line
    ctx.font = '500 30px system-ui, sans-serif';
    ctx.fillStyle = '#6f6a85';
    ctx.fillText('Ranked ' + ordinal(validator.rank) + ' on Stakewiz', 250, 230);

    if (validator.is_jito) {
        // Jito badge
        drawRoundedRect(ctx, 250, 285, 130, 42, 21);
        ctx.fillStyle = 'rgba(217, 119, 6, 0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#b45309';
        ctx.font = '700 20px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText('JITO MEV', 315, 306);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'top';
    }

    // KPI grid at bottom
    const kpiTop = 390;
    const kpiPad = 60;
    const kpiGap = 24;
    const kpiCount = 4;
    const kpiW = (CARD_WIDTH - kpiPad * 2 - kpiGap * (kpiCount - 1)) / kpiCount;
    const kpiH = 170;

    const kpis: { label: string; value: string; color: string }[] = [
        { label: 'WIZ SCORE', value: validator.wiz_score + '%', color: '#b45309' },
        { label: 'TRUEAPY', value: validator.total_apy + '%', color: '#5907e6' },
        { label: 'COMMISSION', value: validator.commission + '%', color: '#7c7ee1' },
        { label: 'SKIP RATE', value: validator.skip_rate.toFixed(1) + '%', color: '#15803d' }
    ];

    kpis.forEach((kpi, i) => {
        const x = kpiPad + i * (kpiW + kpiGap);
        drawRoundedRect(ctx, x, kpiTop, kpiW, kpiH, 18);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(22, 16, 53, 0.10)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Colored top bar
        drawRoundedRect(ctx, x, kpiTop, kpiW, 4, 2);
        ctx.fillStyle = kpi.color;
        ctx.fill();

        ctx.fillStyle = '#6f6a85';
        ctx.font = '600 18px system-ui, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(kpi.label, x + 22, kpiTop + 28);

        ctx.fillStyle = '#16102e';
        ctx.font = '700 48px system-ui, sans-serif';
        ctx.fillText(kpi.value, x + 22, kpiTop + 68);
    });

    // Footer
    ctx.fillStyle = '#6f6a85';
    ctx.font = '500 22px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('stakewiz.com/validator/' + validator.vote_identity.slice(0, 12) + '…', 60, CARD_HEIGHT - 60);
    ctx.textAlign = 'end';
    ctx.fillStyle = '#5907e6';
    ctx.fillText('Stake with confidence.', CARD_WIDTH - 60, CARD_HEIGHT - 60);
    ctx.textAlign = 'start';
};

const ShareCardModal: FC<ShareCardModalProps> = ({ show, onHide, validator }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dataUrl, setDataUrl] = useState<string>('');
    const [rendering, setRendering] = useState<boolean>(false);

    useEffect(() => {
        if (!show || !validator || !canvasRef.current) return;
        setRendering(true);
        drawCard(canvasRef.current, validator).then(() => {
            if (canvasRef.current) {
                setDataUrl(canvasRef.current.toDataURL('image/png'));
            }
            setRendering(false);
        });
    }, [show, validator]);

    if (!validator) return null;

    const shareText = encodeURIComponent(
        `Staking check: ${validator.name || validator.vote_identity.slice(0, 8)} · Wiz ${validator.wiz_score}% · APY ${validator.total_apy}% · Commission ${validator.commission}% via @Stakewiz`
    );
    const shareUrl = encodeURIComponent(
        typeof window !== 'undefined'
            ? window.location.origin + '/validator/' + validator.vote_identity
            : 'https://stakewiz.com/validator/' + validator.vote_identity
    );
    const twitterHref = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;

    return (
        <Modal show={show} onHide={onHide} centered size="lg" className="text-white">
            <Modal.Header closeButton>
                <Modal.Title>Share validator</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="sw-share-preview">
                    <canvas ref={canvasRef} className="sw-share-canvas" style={{ display: dataUrl ? 'none' : 'block' }} />
                    {dataUrl ? (
                        <img src={dataUrl} alt="Share card" className="sw-share-img" />
                    ) : null}
                    {rendering ? <div className="sw-share-loading">Rendering…</div> : null}
                </div>
                <p className="sw-share-hint">
                    Post this card on X to shout out {validator.name || 'this validator'} — the image is generated on your device, no upload needed.
                </p>
                <div className="sw-share-actions">
                    <a
                        className="btn sw-btn-primary"
                        href={dataUrl || '#'}
                        download={`stakewiz-${(validator.name || validator.vote_identity).replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`}
                    >
                        <i className="bi bi-download me-2" /> Download PNG
                    </a>
                    <a className="btn sw-btn-ghost" href={twitterHref} target="_blank" rel="noopener noreferrer">
                        <i className="bi bi-twitter-x me-2" /> Post to X
                    </a>
                    <button
                        type="button"
                        className="btn sw-btn-ghost"
                        onClick={() => {
                            if (typeof window !== 'undefined' && navigator.clipboard) {
                                navigator.clipboard.writeText(window.location.origin + '/validator/' + validator.vote_identity);
                            }
                        }}
                    >
                        <i className="bi bi-link-45deg me-2" /> Copy link
                    </button>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default ShareCardModal;
