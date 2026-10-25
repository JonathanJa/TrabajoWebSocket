import type { ReactNode } from 'react';

/** Pantalla de la app: incluye las capas obligatorias del tema (.tp-stage/.tp-screen/.tp-fx). */
export const Screen = ({ children }: { children: ReactNode }) => (
    <div className="tp-stage">
        <div className="tp-screen d-shell">
            <a className="d-skip" href="#damas-main">
                Saltar al contenido principal
            </a>
            <span className="tp-fx" aria-hidden="true" />
            <span className="d-aurora" aria-hidden="true" />
            <span className="d-stars" aria-hidden="true" />
            <span className="d-rings" aria-hidden="true" />
            <span className="d-scan" aria-hidden="true" />
            {children}
        </div>
    </div>
);

interface HeaderProps {
    code: string;
    title: string;
    meta: string;
    right?: ReactNode;
}

export const Header = ({ code, title, meta, right }: HeaderProps) => (
    <header
        className="d-row d-row--between d-head"
        style={{ alignItems: 'flex-end' }}
    >
        <div className="d-stack d-head__stack" style={{ gap: 6 }}>
            <p
                className="d-mono d-acc d-glitch d-head__code"
                style={{ margin: 0 }}
            >
                {code}
            </p>
            <h1
                id="damas-page-title"
                tabIndex={-1}
                className="d-display d-head__title"
                style={{
                    fontSize: 'var(--d-title, clamp(26px,7vw,40px))',
                    margin: 0,
                }}
            >
                {title}
            </h1>
            <p className="d-mono d-mute d-head__meta" style={{ margin: 0 }}>
                {meta}
            </p>
        </div>
        {right === undefined ? null : right}
    </header>
);
