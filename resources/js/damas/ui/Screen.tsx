import type { ReactNode } from 'react';

/** Pantalla de la app: incluye las capas obligatorias del tema (.tp-stage/.tp-screen/.tp-fx). */
export const Screen = ({ children }: { children: ReactNode }) => (
    <div className="tp-stage">
        <div className="tp-screen d-shell">
            <span className="tp-fx" aria-hidden="true" />
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
    <header className="d-row d-row--between" style={{ alignItems: 'flex-end' }}>
        <div className="d-stack" style={{ gap: 6 }}>
            <p className="d-mono d-acc d-glitch" style={{ margin: 0 }}>
                {code}
            </p>
            <h1 className="d-display" style={{ fontSize: 'clamp(26px,7vw,40px)', margin: 0 }}>
                {title}
            </h1>
            <p className="d-mono d-mute" style={{ margin: 0 }}>
                {meta}
            </p>
        </div>
        {right === undefined ? null : right}
    </header>
);
