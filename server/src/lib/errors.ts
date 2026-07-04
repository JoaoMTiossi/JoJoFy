export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const Errors = {
  badRequest: (msg: string) => new AppError(400, "BAD_REQUEST", msg),
  unauthorized: (msg = "Não autenticado") => new AppError(401, "UNAUTHORIZED", msg),
  forbidden: (msg = "Sem permissão") => new AppError(403, "FORBIDDEN", msg),
  notFound: (msg = "Não encontrado") => new AppError(404, "NOT_FOUND", msg),
  conflict: (msg: string) => new AppError(409, "CONFLICT", msg),
  paymentRequired: (msg = "Créditos insuficientes") => new AppError(402, "PAYMENT_REQUIRED", msg),
};
