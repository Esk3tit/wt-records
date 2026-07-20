// Escape LIKE metacharacters so '_' / '%' in user text match literally.
export function likeContains(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`
}
