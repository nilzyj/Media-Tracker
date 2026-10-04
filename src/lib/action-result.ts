export type ActionResult<T = undefined> =
  | (undefined extends T ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export function ok(): { ok: true } {
  return { ok: true };
}

export function okWith<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "发生未知错误";
}
