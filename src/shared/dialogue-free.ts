import type { MovieCreate } from "./model";

const robotDreamsSource = {
  label: "戛纳电影节导演访谈",
  url: "https://www.festival-cannes.com/2023/robot-dreams-entretien-avec-le-realisateur-pablo-berger/",
};
const robotDreamsNote = `- 全片无对白。 [${robotDreamsSource.label}](${robotDreamsSource.url})`;

export function dialogueFreeSource(
  movie: Pick<
    MovieCreate,
    "id" | "type" | "year" | "status" | "editorialMarkdown"
  >,
) {
  if (
    movie.id === "douban-35426925" &&
    movie.type === "movie" &&
    movie.year === 2023 &&
    movie.status === "listed" &&
    movie.editorialMarkdown.split(/\r?\n/).includes(robotDreamsNote)
  ) {
    return robotDreamsSource;
  }
}
