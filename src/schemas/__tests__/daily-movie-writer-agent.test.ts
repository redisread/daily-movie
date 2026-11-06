import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const AGENT_PATH = join(process.cwd(), 'agents', 'daily-movie-writer.md');

describe('daily-movie-writer agent', () => {
  it('文件存在', () => {
    expect(existsSync(AGENT_PATH)).toBe(true);
  });

  it('包含合法 frontmatter', () => {
    const raw = readFileSync(AGENT_PATH, 'utf-8');
    expect(raw.startsWith('---\n')).toBe(true);
    const endIdx = raw.indexOf('\n---\n', 4);
    expect(endIdx).toBeGreaterThan(4);
  });

  it('frontmatter 字段齐全', () => {
    const raw = readFileSync(AGENT_PATH, 'utf-8');
    const fm = raw.slice(4, raw.indexOf('\n---\n', 4));
    expect(fm).toMatch(/^name:\s*daily-movie-writer\s*$/m);
    expect(fm).toMatch(/^description:\s*.+/m);
    expect(fm).toMatch(/^model:\s*\S+\s*$/m);
  });

  it('description 提及触发关键词', () => {
    const raw = readFileSync(AGENT_PATH, 'utf-8');
    const fm = raw.slice(4, raw.indexOf('\n---\n', 4));
    const descLine = fm.split('\n').find((line: string) => line.startsWith('description:')) ?? '';
    const hits = ['daily-movie', 'movies/', 'HTTP API'].filter((k) =>
      descLine.includes(k)
    );
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('system prompt 包含关键约束', () => {
    const raw = readFileSync(AGENT_PATH, 'utf-8');
    const body = raw.slice(raw.indexOf('\n---\n', 4) + 5);
    expect(body).toMatch(/kebab-case/);
    expect(body).toMatch(/publishedDate/);
    expect(body).toMatch(/posters/);
    expect(body).toContain('Idempotency-Key');
    expect(body).toContain('If-Match');
    expect(body).toContain('CONTENT_API_KEY');
    expect(body).toMatch(/不要.*commit|不要.*push/i);
    expect(body).toMatch(/npm run test/);
  });

  it('未引用 .claude/agents/ 路径（项目忽略该目录）', () => {
    const raw = readFileSync(AGENT_PATH, 'utf-8');
    expect(raw).not.toMatch(/\.claude\/agents\//);
  });
});
