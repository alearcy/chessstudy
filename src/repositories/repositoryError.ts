export function throwIfError(error: { message?: string } | null): void {
  if (error) throw error;
}

export function requireData<T>(
  data: T | null,
  error: { message?: string } | null,
  fallback: string,
): T {
  throwIfError(error);
  if (data == null) throw new Error(fallback);
  return data;
}
