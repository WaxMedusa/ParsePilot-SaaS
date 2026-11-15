import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

type SharedProps = {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  iconAfter?: ReactNode;
  children: ReactNode;
  className?: string;
};

function classes({ variant = 'primary', size = 'md', block, className }: SharedProps) {
  return [styles.button, styles[variant], styles[size], block ? styles.block : '', className ?? ''].filter(Boolean).join(' ');
}

export function Button({ variant, size, block, icon, iconAfter, children, className, ...rest }: SharedProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={classes({ variant, size, block, className, children })} {...rest}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span>{children}</span>
      {iconAfter ? <span className={styles.icon}>{iconAfter}</span> : null}
    </button>
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  block,
  icon,
  iconAfter,
  children,
  className,
  external,
}: SharedProps & { href: string; external?: boolean }) {
  const content = (
    <>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span>{children}</span>
      {iconAfter ? <span className={styles.icon}>{iconAfter}</span> : null}
    </>
  );
  const cls = classes({ variant, size, block, className, children });
  if (external) {
    return (
      <a className={cls} href={href} rel="noreferrer noopener" target="_blank">
        {content}
      </a>
    );
  }
  return (
    <Link className={cls} href={href}>
      {content}
    </Link>
  );
}
