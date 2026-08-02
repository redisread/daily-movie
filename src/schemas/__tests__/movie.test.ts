import { describe, it, expect } from 'vitest';
import { MovieSchema } from '../movie';
import { movies } from '../../data/movies';

describe('MovieSchema', () => {
  it('validates all sample movies', () => {
    for (const movie of movies) {
      expect(() => MovieSchema.parse(movie)).not.toThrow();
    }
  });

  it('provides a real cover image for every movie', () => {
    for (const movie of movies) {
      expect(movie.cover.url).not.toContain('placehold.co');
    }
  });

  it('rejects invalid movie with bad id', () => {
    expect(() => MovieSchema.parse({ id: 'INVALID!' })).toThrow();
  });

  it('rejects movie with missing required fields', () => {
    expect(() => MovieSchema.parse({ id: 'test' })).toThrow();
  });

  it('enforces poster count 3-5', () => {
    const movie = movies[0];
    const tooFewPosters = { ...movie, posters: [{ url: 'https://example.com/1.jpg' }] };
    expect(() => MovieSchema.parse(tooFewPosters)).toThrow();
  });

  it('enforces cast count 3-5', () => {
    const movie = movies[0];
    const tooFewCast = { ...movie, cast: [{ name: 'Actor', role: 'Role' }] };
    expect(() => MovieSchema.parse(tooFewCast)).toThrow();
  });

  it('enforces quotes count 3-10', () => {
    const movie = movies[0];
    const tooFewQuotes = { ...movie, quotes: [{ text: 'Quote 1' }] };
    expect(() => MovieSchema.parse(tooFewQuotes)).toThrow();
  });

  it('validates year range', () => {
    const movie = movies[0];
    const invalidYear = { ...movie, year: 1800 };
    expect(() => MovieSchema.parse(invalidYear)).toThrow();
  });

  it('validates rating range', () => {
    const movie = movies[0];
    const invalidRating = { ...movie, rating: 11 };
    expect(() => MovieSchema.parse(invalidRating)).toThrow();
  });

  it('validates publishedDate format', () => {
    const movie = movies[0];
    const invalidDate = { ...movie, publishedDate: '2026/06/30' };
    expect(() => MovieSchema.parse(invalidDate)).toThrow();
  });
});
