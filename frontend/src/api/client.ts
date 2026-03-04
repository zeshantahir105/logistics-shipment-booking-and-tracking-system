import axios, { AxiosError } from 'axios';

const baseURL =
  import.meta.env.VITE_API_URL != null && import.meta.env.VITE_API_URL !== ''
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api';

export const api = axios.create({
  baseURL,
});

export interface ApiValidationError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: number;
  message: string;
  details?: ApiValidationError[] | Record<string, unknown> | null;
}

/** Extract a human-readable message from an Axios error. */
export function getApiErrorMessage(err: unknown): string {
  if (err instanceof AxiosError && err.response?.data) {
    const body = err.response.data as ApiErrorBody;
    return body.message ?? 'An unexpected error occurred';
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

/** Extract field-level validation errors from an Axios 400 response. */
export function getApiFieldErrors(err: unknown): Record<string, string> {
  if (err instanceof AxiosError && err.response?.status === 400) {
    const body = err.response.data as ApiErrorBody;
    if (Array.isArray(body.details)) {
      return Object.fromEntries(body.details.map((d) => [d.field, d.message]));
    }
  }
  return {};
}
