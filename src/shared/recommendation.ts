import type { Movie } from "./model";

export const todayRecommendationPath = "/api/v1/recommendations/today";

export type TodayRecommendation = {
  data: { movie: Movie; href: string } | null;
  meta: { day: string };
};
