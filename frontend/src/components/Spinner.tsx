interface SpinnerProps {
  label?: string;
}

const Spinner = ({ label = "Loading events…" }: SpinnerProps) => (
  <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-12 text-gray-700">
    <span
      aria-hidden="true"
      className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700"
    />
    <span>{label}</span>
  </div>
);

export default Spinner;
