/**
 * Creates an Error object without a stack trace
 * @param message The error message
 * @returns Error object with no stack trace
 */
export function stacklessError(message: string): Error {
  const error = new Error(message);
  error.stack = undefined;
  return error;
}