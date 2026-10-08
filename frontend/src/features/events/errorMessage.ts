import axios from "axios";
import type { ApiErrorBody } from "../../types/event";

const isApiErrorBody = (data: unknown): data is ApiErrorBody =>
  typeof data === "object" && data !== null && "message" in data && typeof data.message === "string";

// A readable message for a failed request: the API's own message when it sent one.
export const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (isApiErrorBody(data)) return data.message;
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
};
