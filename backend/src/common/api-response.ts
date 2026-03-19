/**
 * Standard response wrapper for the API.
 *
 * Success shape:  { success: true, data?: T, message?: string }
 * Error shape:    { success: false, error: string, statusCode: number }
 *
 * Not every endpoint needs to use ApiResponse.ok() —
 * Prisma data returns and lists are fine as-is.
 * Use this mainly for mutation acknowledgements.
 */
export class ApiResponse<T = unknown> {
  success!: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;

  static ok<T>(data?: T, message?: string): ApiResponse<T> {
    return { success: true, data, message };
  }

  static fail(error: string, statusCode = 400): ApiResponse {
    return { success: false, error, statusCode };
  }
}
