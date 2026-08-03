import type { Movie } from '../schemas/movie';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

export function movieToRssContent(movie: Movie): string {
  const typeLabel = movie.type === 'tv' ? '剧集' : '电影';
  const genres = movie.genre.map(escapeHtml).join('、');
  const cast = movie.cast
    .map((member) => `<li>${escapeHtml(member.name)} · ${escapeHtml(member.role)}</li>`)
    .join('');
  const quotes = movie.quotes
    .map((quote) => {
      const speaker = quote.speaker ? `<cite>——${escapeHtml(quote.speaker)}</cite>` : '';
      const timestamp = quote.timestamp ? ` <small>（${escapeHtml(quote.timestamp)}）</small>` : '';
      return `<blockquote><p>${escapeHtml(quote.text)}${timestamp}</p>${speaker}</blockquote>`;
    })
    .join('');

  return [
    '<article>',
    '<header>',
    `<p>${typeLabel} · ${movie.publishedDate}</p>`,
    `<h1>${escapeHtml(movie.title)}</h1>`,
    movie.titleOriginal ? `<p>${escapeHtml(movie.titleOriginal)}</p>` : '',
    '</header>',
    `<p><strong>导演：</strong>${escapeHtml(movie.director.name)} · <strong>年份：</strong>${movie.year} · <strong>类型：</strong>${genres}</p>`,
    movie.director.works ? `<p><strong>导演代表作：</strong>${escapeHtml(movie.director.works)}</p>` : '',
    `<p><strong>评分：</strong>${movie.rating.toFixed(1)} / 10 · <strong>时长：</strong>${movie.duration} 分钟</p>`,
    `<img src="${escapeHtml(movie.cover.url)}" alt="《${escapeHtml(movie.title)}》电影海报">`,
    `<section><h2>主要演员</h2><ul>${cast}</ul></section>`,
    '<section>',
    '<h2>剧情简介</h2>',
    `<p>${escapeHtml(movie.synopsis)}</p>`,
    '</section>',
    '<section>',
    `<h2>电影语录</h2>${quotes}`,
    '</section>',
    movie.whyThisMovie
      ? `<section><h2>为什么今天该看</h2><p>${escapeHtml(movie.whyThisMovie)}</p></section>`
      : '',
    '</article>',
  ].join('');
}
