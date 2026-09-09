import { apiErrorSchema } from "@devcontext/contracts";

export type ApiErrorDetail = { path: string[]; code: string };

const fallbackMessage = "The request could not be completed.";

function looseMessage(value: unknown) {
  if (typeof value !== "object" || value === null || !("error" in value)) return null;
  const error = value.error;
  if (typeof error !== "object" || error === null || !("message" in error)) return null;
  return typeof error.message === "string" ? error.message : null;
}

/** Reads the shared API error envelope; proxy failures without a code still yield their message. */
export async function readApiError(response: Response): Promise<{ message: string; details: ApiErrorDetail[] }> {
  try {
    const body: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) return { message: parsed.data.error.message, details: parsed.data.error.details ?? [] };
    const message = looseMessage(body);
    if (message) return { message, details: [] };
  } catch {
    // Non-JSON body; fall through to the generic message.
  }
  return { message: fallbackMessage, details: [] };
}

export async function responseError(response: Response) {
  return (await readApiError(response)).message;
}
