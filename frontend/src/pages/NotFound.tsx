import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="mx-auto max-w-2xl py-12 text-center">
    <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
    <p className="mt-2 text-gray-700">
      <Link to="/" className="font-medium text-emerald-800 underline">
        Back to today’s free food
      </Link>
    </p>
  </div>
);

export default NotFound;
