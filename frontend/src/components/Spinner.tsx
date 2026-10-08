interface SpinnerProps {
  label?: string;
}

const Spinner = ({ label = "Loading events…" }: SpinnerProps) => (
  <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16">
    <span aria-hidden="true" className="size-8 animate-spin rounded-full border-[3px] border-line border-t-primary" />
    <p className="text-sm text-ink-muted">{label}</p>
  </div>
);

export default Spinner;
