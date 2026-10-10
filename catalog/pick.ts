/** A Map's own slice of a Catalog table: the ids it uses, Catalog values as they are (spread to override). */
export const pick = <T>(all: Record<string, T>, ids: string[]): Record<string, T> =>
  Object.fromEntries(ids.map((id) => [id, all[id]]));
