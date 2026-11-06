export function shanghaiDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export const movieHref = (id: string) => `/movies/${encodeURIComponent(id)}`;
export const etag = (resource: { id: string; version: number }) =>
  `"${resource.id}:v${resource.version}"`;
