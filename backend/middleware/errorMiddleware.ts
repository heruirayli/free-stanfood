import type { ErrorRequestHandler, RequestHandler } from "express";

// Unknown /api routes get a JSON 404 instead of falling through to the SPA.
export const notFound: RequestHandler = (req, res, next) => {
  res.status(404);
  next(new Error(`Not found: ${req.originalUrl}`));
};

const statusFromError = (err: unknown): number | undefined => {
  if (typeof err === "object" && err !== null && "status" in err && typeof err.status === "number") {
    return err.status;
  }
  return undefined;
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Controllers set res.status(4xx) before throwing. Body-parser errors carry their own status.
  const statusCode = res.statusCode >= 400 ? res.statusCode : (statusFromError(err) ?? 500);

  res.status(statusCode);
  res.json({
    message: err instanceof Error ? err.message : "Server error",
    stack: process.env.NODE_ENV === "production" ? null : err instanceof Error ? err.stack : null,
  });
};
