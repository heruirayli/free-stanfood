import Loader from "./kokonut/Loader";

interface SpinnerProps {
  label?: string;
}

const Spinner = ({ label = "Loading events…" }: SpinnerProps) => (
  <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-4 py-16">
    <Loader />
    <p className="text-sm text-stone-600">{label}</p>
  </div>
);

export default Spinner;
