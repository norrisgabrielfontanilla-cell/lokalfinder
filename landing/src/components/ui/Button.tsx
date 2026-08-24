import type { AnchorHTMLAttributes } from 'react';

type ButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: 'primary' | 'secondary' | 'inverted' | 'outline-light';
};

// Each variant is a fully self-contained class string — never mix a variant
// with an overriding className for colors, since Tailwind's generated
// stylesheet order (not JSX class order) decides which utility wins, which
// can silently produce invisible text (e.g. white-on-white).
const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand text-white hover:bg-brand/90',
  secondary: 'bg-transparent text-ink border border-ink/15 hover:border-ink/30',
  inverted: 'bg-white text-brand-dark hover:bg-white/90',
  'outline-light': 'bg-transparent text-white border border-white/30 hover:border-white/60',
};

export default function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-7 sm:py-3.5 text-sm font-medium rounded-lg transition-colors duration-200';

  return (
    <a className={`${base} ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </a>
  );
}
