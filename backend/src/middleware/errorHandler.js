export function notFoundHandler(_req, _res, next) {
  const error = new Error("Route not found");
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  const isDuplicateKey = error?.code === 11000;
  const statusCode = isDuplicateKey ? 409 : error.statusCode || 500;
  const message = isDuplicateKey
    ? "A record with this value already exists"
    : statusCode === 500 ? "An unexpected error occurred" : error.message;

  if (statusCode === 500) console.error(error);
  res.status(statusCode).json({ success: false, error: { message } });
}
