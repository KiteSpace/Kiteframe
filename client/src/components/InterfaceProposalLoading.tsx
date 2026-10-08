/** Skeleton card with fake browser chrome, matching the existing proposal loading treatment. */
export function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 animate-pulse" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-3 aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted relative">
        <div className="absolute inset-0 flex flex-col">
          <div className="flex h-5 flex-shrink-0 items-center gap-1 bg-muted-foreground/10 px-2">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
            <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
            <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="flex w-10 flex-shrink-0 flex-col gap-1.5 bg-muted-foreground/10 p-1.5">
              <div className="h-2 rounded bg-muted-foreground/20" />
              <div className="h-2 w-2/3 rounded bg-muted-foreground/20" />
              <div className="h-2 rounded bg-muted-foreground/20" />
              <div className="h-2 w-3/4 rounded bg-muted-foreground/20" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
              <div className="h-3 w-1/2 rounded bg-muted-foreground/20" />
              <div className="flex min-h-0 flex-1 gap-1">
                <div className="flex-1 rounded bg-muted-foreground/15" />
                <div className="flex-1 rounded bg-muted-foreground/15" />
                <div className="flex-1 rounded bg-muted-foreground/15" />
              </div>
              <div className="h-4 rounded bg-muted-foreground/15" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded bg-muted-foreground/20" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/4 rounded bg-muted-foreground/20" />
          <div className="h-2 w-full rounded bg-muted-foreground/15" />
          <div className="h-2 w-2/3 rounded bg-muted-foreground/15" />
        </div>
      </div>
    </div>
  );
}

/** Large canvas treatment shown while the selected screens become a real UI. */
export function UiGenerationShimmer() {
  return (
    <div className="ui-generation-canvas flex-1 overflow-auto p-4 sm:p-6 lg:p-10" data-testid="ui-generation-shimmer" role="status" aria-label="Generating your UI">
      <div className="ui-generation-mock mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
        <div className="ui-generation-titlebar flex h-10 items-center gap-2 border-b border-border/70 px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <div className="ui-shimmer-block ml-4 h-2.5 w-28 rounded-full" />
        </div>
        <div className="flex min-h-[min(58vw,520px)]">
          <aside className="ui-generation-sidebar hidden w-44 flex-shrink-0 border-r border-border/70 p-4 sm:block">
            <div className="ui-shimmer-block mb-7 h-7 w-24 rounded-md" />
            <div className="space-y-3">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="flex items-center gap-2">
              <div className="ui-shimmer-block h-3 w-3 rounded-sm" />
              <div className={`ui-shimmer-block h-2.5 rounded-full ${item === 0 ? 'w-24' : item === 2 ? 'w-16' : 'w-20'}`} />
            </div>)}</div>
            <div className="ui-shimmer-block mt-12 h-20 w-full rounded-lg" />
          </aside>
          <main className="min-w-0 flex-1 p-5 sm:p-8">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div className="space-y-2"><div className="ui-shimmer-block h-5 w-36 rounded-md sm:w-52" /><div className="ui-shimmer-block h-2.5 w-48 rounded-full sm:w-72" /></div>
              <div className="ui-shimmer-block h-8 w-20 rounded-lg sm:w-28" />
            </div>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="rounded-xl border border-border/60 p-3">
              <div className="mb-4 flex items-center justify-between"><div className="ui-shimmer-block h-3 w-16 rounded-full" /><div className="ui-shimmer-block h-6 w-6 rounded-md" /></div>
              <div className="ui-shimmer-block h-7 w-20 rounded-md" /><div className="ui-shimmer-block mt-3 h-2 w-28 rounded-full" />
            </div>)}</div>
            <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <div className="rounded-xl border border-border/60 p-4">
                <div className="mb-5 flex items-center justify-between"><div className="ui-shimmer-block h-3.5 w-28 rounded-full" /><div className="ui-shimmer-block h-6 w-16 rounded-md" /></div>
                <div className="ui-shimmer-chart flex h-36 items-end gap-2 rounded-lg p-4">{[42, 68, 52, 82, 61, 92, 74, 100, 78, 88].map((height, index) => <div key={index} className="ui-shimmer-block flex-1 rounded-t-md" style={{ height: `${height}%`, animationDelay: `${index * 80}ms` }} />)}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <div className="ui-shimmer-block mb-5 h-3.5 w-24 rounded-full" />
                <div className="space-y-3">{[0, 1, 2, 3].map((item) => <div key={item} className="flex items-center gap-3">
                  <div className="ui-shimmer-block h-8 w-8 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2"><div className="ui-shimmer-block h-2.5 w-3/4 rounded-full" /><div className="ui-shimmer-block h-2 w-1/2 rounded-full" /></div>
                  <div className="ui-shimmer-block h-2.5 w-10 rounded-full" />
                </div>)}</div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">Assembling your interface from the selected screens…</p>
    </div>
  );
}
