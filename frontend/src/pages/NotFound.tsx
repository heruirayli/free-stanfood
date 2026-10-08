import { useRef } from "react";
import { Link } from "react-router-dom";
import { APP_NAME } from "../constants";
import { useFocusOnNavigate } from "../hooks/useFocusOnNavigate";
import { primaryButtonClass } from "../styles";

const NotFound = () => {
  const heading = useRef<HTMLHeadingElement>(null);
  useFocusOnNavigate(heading);

  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <title>{`Page Not Found · ${APP_NAME}`}</title>
      <h1 ref={heading} tabIndex={-1} className="text-[1.75rem] font-bold text-ink focus:outline-none">
        Page Not Found
      </h1>
      <p className="mt-6">
        <Link
          to="/"
          className={primaryButtonClass}
        >
          Back to today’s free food
        </Link>
      </p>
    </div>
  );
};

export default NotFound;
