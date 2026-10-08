// Gray placeholders in the shape of what's loading, so the page doesn't jump
// when it arrives. They pulse gently (not with reduced motion).

const Bar = ({ className }: { className: string }) => (
  <span aria-hidden="true" className={`block rounded-md bg-surface-strong ${className}`} />
);

const CardSkeleton = () => (
  <div className="rounded-xl border border-line py-3.5 pr-4 pl-5">
    <Bar className="h-5 w-2/5" />
    <Bar className="mt-2 h-4 w-4/5" />
    <Bar className="mt-3 h-3.5 w-1/2" />
    <Bar className="mt-2 h-3.5 w-3/5" />
    <div className="mt-3 flex gap-1.5">
      <Bar className="h-6 w-24 rounded-full" />
      <Bar className="h-6 w-24 rounded-full" />
    </div>
  </div>
);

export const AgendaSkeleton = () => (
  <div role="status" className="animate-pulse">
    <span className="sr-only">Loading events…</span>
    <Bar className="mt-2.5 mb-4.5 h-5 w-36" />
    <div className="space-y-3">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  </div>
);

export const DetailsSkeleton = () => (
  <div role="status" className="animate-pulse">
    <span className="sr-only">Loading event…</span>
    <Bar className="h-7 w-1/2" />
    <Bar className="mt-2.5 h-5 w-4/5" />
    <div className="mt-4 flex gap-1.5">
      <Bar className="h-6 w-24 rounded-full" />
      <Bar className="h-6 w-24 rounded-full" />
    </div>
    <Bar className="mt-5 h-28 w-full rounded-xl" />
    <Bar className="mt-5 h-4 w-full" />
    <Bar className="mt-2 h-4 w-11/12" />
    <Bar className="mt-2 h-4 w-3/5" />
  </div>
);
