/** Instagram-style @handle from a public id (user handle or org slug). */
export function formatAtHandle(id: string | null | undefined): string | null {
  if (!id) return null;
  return `@${id}`;
}
