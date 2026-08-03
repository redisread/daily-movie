import { describe, expect, it } from 'vitest';
import { movies } from '../movies';
import { movieToRssContent } from '../movie-rss';

describe('movie RSS content', () => {
  it('includes the complete movie details', () => {
    const movie = movies.find(({ id }) => id === 'the-shawshank-redemption');

    expect(movie).toBeDefined();
    const content = movieToRssContent(movie!);

    expect(content).toContain(movie!.synopsis);
    expect(content).toContain(movie!.whyThisMovie!);
    for (const quote of movie!.quotes) {
      expect(content).toContain(quote.text);
    }
    for (const member of movie!.cast) {
      expect(content).toContain(member.name);
      expect(content).toContain(member.role);
    }
    expect(content).toContain(movie!.director.name);
    expect(content).toContain(`${movie!.rating.toFixed(1)} / 10`);
  });

  it('escapes values before placing them in HTML', () => {
    const movie = {
      ...movies[0],
      title: '<电影 & 标题>',
      synopsis: '简介 <script>alert("xss")</script>',
    };

    const content = movieToRssContent(movie);

    expect(content).toContain('&lt;电影 &amp; 标题&gt;');
    expect(content).toContain('简介 &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(content).not.toContain('<script>');
  });
});
