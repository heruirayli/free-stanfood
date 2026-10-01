import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="mx-auto max-w-2xl py-16 text-center">
    <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Page Not Found</h1>
    <p className="mt-6">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center rounded-full bg-stone-900 px-5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
      >
        Back to today’s free food
      </Link>
    </p>
  </div>
);

export default NotFound;
