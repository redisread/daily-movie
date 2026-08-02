import { parse } from 'yaml';
import { MovieSchema, type Movie } from '../schemas/movie';

type MovieDocument = Record<string, string>;

const movieDocuments = import.meta.glob('./movies/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as MovieDocument;

function parseMovieDocument(content: string, filename: string): Movie {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`电影文档缺少 frontmatter: ${filename}`);
  }

  try {
    return MovieSchema.parse(parse(match[1]));
  } catch (error) {
    throw new Error(`电影文档校验失败: ${filename}\n${String(error)}`, { cause: error });
  }
}

function loadMovies(): Movie[] {
  return Object.entries(movieDocuments)
    .map(([filename, content]) => parseMovieDocument(content, filename))
    .sort((a, b) => a.publishedDate.localeCompare(b.publishedDate));
}

export const movies: Movie[] = loadMovies();
