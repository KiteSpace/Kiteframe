import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { X, ExternalLink, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'critical';
  ctaLabel: string | null;
  ctaUrl: string | null;
}

const TYPE_STYLES: Record<string, { banner: string; icon: string; btn: string; dismiss: string }> = {
  info:     { banner: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',     icon: 'text-blue-500',   btn: 'bg-blue-600 hover:bg-blue-700 text-white',        dismiss: 'text-blue-400 hover:text-blue-600 dark:hover:text-blue-300' },
  warning:  { banner: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800', icon: 'text-amber-500',  btn: 'bg-amber-600 hover:bg-amber-700 text-white',      dismiss: 'text-amber-400 hover:text-amber-600 dark:hover:text-amber-300' },
  success:  { banner: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800', icon: 'text-green-500',  btn: 'bg-green-600 hover:bg-green-700 text-white',      dismiss: 'text-green-400 hover:text-green-600 dark:hover:text-green-300' },
  critical: { banner: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',         icon: 'text-red-500',    btn: 'bg-red-600 hover:bg-red-700 text-white',          dismiss: 'text-red-400 hover:text-red-600 dark:hover:text-red-300' },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  info:     <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />,
  warning:  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />,
  success:  <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />,
  critical: <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />,
};

function AnnouncementItem({ announcement, onDismiss }: { announcement: Announcement; onDismiss: (id: string) => void }) {
  const styles = TYPE_STYLES[announcement.type] || TYPE_STYLES.info;

  return (
    <div className={`w-full border-b px-4 py-2.5 ${styles.banner}`}>
      <div className="max-w-screen-xl mx-auto flex items-start gap-3">
        <span className={styles.icon}>
          {TYPE_ICONS[announcement.type]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">
            {announcement.title}
            {announcement.message && (
              <span className="font-normal text-muted-foreground ml-1">— {announcement.message}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {announcement.ctaLabel && announcement.ctaUrl && (
            <a
              href={announcement.ctaUrl}
              target={announcement.ctaUrl.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-md transition-colors ${styles.btn}`}
            >
              {announcement.ctaLabel}
              {announcement.ctaUrl.startsWith('http') && <ExternalLink className="h-3 w-3" />}
            </a>
          )}
          <button
            onClick={() => onDismiss(announcement.id)}
            className={`p-1 rounded transition-colors ${styles.dismiss}`}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AnnouncementBanner() {
  const [locallyDismissed, setLocallyDismissed] = useState<Set<string>>(new Set());

  const { data } = useQuery<{ announcements: Announcement[] }>({
    queryKey: ['/api/announcements'],
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/announcements/${id}/dismiss`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to dismiss');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
    },
  });

  const handleDismiss = (id: string) => {
    setLocallyDismissed(prev => new Set([...prev, id]));
    dismissMutation.mutate(id);
  };

  const visible = (data?.announcements || []).filter(a => !locallyDismissed.has(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="w-full z-50">
      {visible.map(a => (
        <AnnouncementItem key={a.id} announcement={a} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
