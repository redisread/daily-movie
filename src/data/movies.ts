import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { MovieSchema, type Movie } from '../schemas/movie';

function loadMovies(): Movie[] {
  const yamlContent = readFileSync('./src/data/movies.yaml', 'utf-8');
  const rawMovies = parse(yamlContent);
  return rawMovies.map((m: unknown) => MovieSchema.parse(m));
}

export const movies: Movie[] = loadMovies();
