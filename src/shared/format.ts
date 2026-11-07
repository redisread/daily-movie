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

export function durationLabel(movie: {
  type: string;
  duration: number | null;
}): string {
  if (movie.duration === null) return "时长待核实";
  return movie.type === "tv"
    ? `条目记录时长 ${movie.duration} 分钟`
    : `${movie.duration} 分钟`;
}
