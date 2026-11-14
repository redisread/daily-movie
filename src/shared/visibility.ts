import { shanghaiDay } from "./format";
import type { Movie } from "./model";

export type PublicScope = "catalog" | "daily";

export function dailyEligible(movie: Pick<Movie, "status" | "publishedDate">, today = shanghaiDay()) {
  return movie.status === "published" && !!movie.publishedDate && movie.publishedDate <= today;
}

export function catalogVisible(movie: Pick<Movie, "status" | "publishedDate">, today = shanghaiDay()) {
  return movie.status === "listed" || dailyEligible(movie, today);
}
