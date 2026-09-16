import type { ReactNode } from 'react'
export function Section({ children, id, className = '' }: { children: ReactNode; id?: string; className?: string }) { return <section id={id} className={`py-8 sm:py-12 ${className}`}>{children}</section> }
