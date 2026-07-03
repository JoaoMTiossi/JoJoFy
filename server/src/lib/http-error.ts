export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details);
export const unauthorized = (message = "Unauthorized") => new HttpError(401, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, message, details);
