import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type ButtonVariant = 'plain' | 'accent' | 'ghost' | 'danger';

interface ButtonProps {
    children?: ReactNode;
    onClick?: () => void;
    variant?: ButtonVariant;
    icon?: LucideIcon;
    disabled?: boolean;
    wide?: boolean;
    title?: string;
    ariaLabel?: string;
}

const variantClass: Record<ButtonVariant, string> = {
    plain: '',
    accent: 'd-btn--acc',
    ghost: 'd-btn--ghost',
    danger: 'd-btn--danger',
};

export const Button = ({
    children,
    onClick,
    variant = 'plain',
    icon: Icon,
    disabled = false,
    wide = false,
    title,
    ariaLabel,
}: ButtonProps) => (
    <button
        type="button"
        className={`d-btn ${variantClass[variant]} ${wide ? 'd-btn--wide' : ''}`}
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
    >
        {Icon === undefined ? null : <Icon size={16} strokeWidth={2.2} />}
        {children === undefined || children === null ? null : <span>{children}</span>}
    </button>
);

interface IconButtonProps {
    icon: LucideIcon;
    onClick?: () => void;
    disabled?: boolean;
    label: string;
    variant?: ButtonVariant;
}

export const IconButton = ({
    icon: Icon,
    onClick,
    disabled = false,
    label,
    variant = 'plain',
}: IconButtonProps) => (
    <button
        type="button"
        className={`d-btn d-btn--icon ${variantClass[variant]}`}
        onClick={onClick}
        disabled={disabled}
        title={label}
        aria-label={label}
    >
        <Icon size={18} strokeWidth={2.2} />
    </button>
);

interface PlateProps {
    children: ReactNode;
    label?: string;
    accent?: boolean;
    sunken?: boolean;
    className?: string;
}

export const Plate = ({ children, label, accent, sunken, className }: PlateProps) => (
    <section
        className={`d-plate ${accent === true ? 'd-plate--acc' : ''} ${
            sunken === true ? 'd-plate--sunken' : ''
        } ${className ?? ''}`}
    >
        {label === undefined ? null : <p className="d-plate__label">{label}</p>}
        {children}
    </section>
);

export const Chip = ({ children, accent }: { children: ReactNode; accent?: boolean }) => (
    <span className={`d-chip ${accent === true ? 'd-chip--acc' : ''}`}>{children}</span>
);

export const Bar = ({ value, animate }: { value: number; animate?: boolean }) => {
    const clamped = Math.max(0, Math.min(1, value));

    return (
        <div className="d-bar" role="presentation">
            <div
                className={`d-bar__fill ${animate === true ? '' : 'd-bar__fill--set'}`}
                style={{ transform: `scaleX(${clamped})` }}
            />
        </div>
    );
};

export const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
    <p className="d-stat">
        {label}
        <b>{value}</b>
    </p>
);

interface SegOption<T extends string> {
    value: T;
    label: string;
    icon?: LucideIcon;
}

export const SegNav = <T extends string>({
    value,
    options,
    onChange,
    label,
}: {
    value: T;
    options: ReadonlyArray<SegOption<T>>;
    onChange: (next: T) => void;
    label: string;
}) => (
    <div className="d-seg" role="tablist" aria-label={label}>
        {options.map((option) => {
            const Icon = option.icon;

            return (
                <button
                    key={option.value}
                    type="button"
                    role="tab"
                    className="d-seg__item"
                    aria-selected={option.value === value}
                    onClick={() => onChange(option.value)}
                >
                    {Icon === undefined ? null : <Icon size={14} strokeWidth={2.4} />}
                    {option.label}
                </button>
            );
        })}
    </div>
);

export const Divider = () => <hr className="d-hr" />;
