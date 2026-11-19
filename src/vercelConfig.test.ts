import { describe, expect, it } from 'vitest';
import vercelConfig from '../vercel.json';

interface VercelHeaderEntry {
  key: string;
  value: string;
}

interface VercelHeaderRule {
  source: string;
  headers: VercelHeaderEntry[];
}

function resolveEffectiveCacheControl(
  rules: VercelHeaderRule[],
  pathname: string,
): string | undefined {
  let effective: string | undefined;
  for (const rule of rules) {
    const regex = new RegExp(`^${rule.source}$`);
    if (regex.test(pathname)) {
      const cacheHeader = rule.headers.find(
        (h) => h.key.toLowerCase() === 'cache-control',
      );
      if (cacheHeader) {
        effective = cacheHeader.value;
      }
    }
  }
  return effective;
}

describe('vercel.json cache strategy (Option A)', () => {
  it('preserves SPA rewrite to /index.html', () => {
    expect(vercelConfig.rewrites).toEqual([
      { source: '/(.*)', destination: '/index.html' },
    ]);
  });

  it('forces revalidation on HTML entrypoints and SPA routes', () => {
    const rules = vercelConfig.headers ?? [];

    expect(resolveEffectiveCacheControl(rules, '/')).toBe(
      'no-cache, must-revalidate',
    );
    expect(resolveEffectiveCacheControl(rules, '/index.html')).toBe(
      'no-cache, must-revalidate',
    );
    expect(resolveEffectiveCacheControl(rules, '/operaciones')).toBe(
      'no-cache, must-revalidate',
    );
  });

  it('keeps immutable 1-year cache on hashed /assets/* files', () => {
    const rules = vercelConfig.headers ?? [];

    expect(
      resolveEffectiveCacheControl(rules, '/assets/index-Cx_z_shj.js'),
    ).toBe('public, max-age=31536000, immutable');
    expect(
      resolveEffectiveCacheControl(rules, '/assets/index-DniDFdnV.css'),
    ).toBe('public, max-age=31536000, immutable');
  });
});
