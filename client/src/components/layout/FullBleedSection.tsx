import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FullBleedSectionProps {
  children: ReactNode;
  className?: string;
}

export function FullBleedSection({ children, className }: FullBleedSectionProps) {
  return (
    <div
      className={cn('relative', className)}
      style={{
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
      }}
    >
      {children}
    </div>
  );
}
