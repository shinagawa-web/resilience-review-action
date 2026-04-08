const { matchRules, buildChecklist } = require('./main');

const timeoutRule = {
  id: 'timeout',
  name: 'Timeout Values',
  triggers: { keywords: ['timeout', 'connect_timeout'], paths: [] },
  checklist: ['Check upstream timeout', 'Check p99 latency'],
};

const cacheRule = {
  id: 'cache',
  name: 'Cache Configuration',
  triggers: { keywords: ['ttl', 'expire'], paths: ['*cache*', 'redis.conf'] },
  checklist: ['Check cache backend failure'],
};

const replicaRule = {
  id: 'replicas',
  name: 'Replica Count / AZ Configuration',
  triggers: { keywords: ['replicas'], paths: ['**/k8s/*.yaml'] },
  checklist: ['Check single point of failure'],
};

describe('matchRules', () => {
  test('matches by keyword in diff', () => {
    const files = [{ filename: 'app/config.py', patch: '+  timeout = 30' }];
    const result = matchRules([timeoutRule, cacheRule], files);
    expect(result).toEqual([timeoutRule]);
  });

  test('matches by path pattern', () => {
    const files = [{ filename: 'redis.conf', patch: '' }];
    const result = matchRules([timeoutRule, cacheRule], files);
    expect(result).toEqual([cacheRule]);
  });

  test('matches by glob path pattern', () => {
    const files = [{ filename: 'infra/k8s/deployment.yaml', patch: '' }];
    const result = matchRules([replicaRule], files);
    expect(result).toEqual([replicaRule]);
  });

  test('matches multiple rules', () => {
    const files = [{ filename: 'app/config.py', patch: '+  timeout = 30\n+  ttl = 600' }];
    const result = matchRules([timeoutRule, cacheRule], files);
    expect(result).toEqual([timeoutRule, cacheRule]);
  });

  test('returns empty when no match', () => {
    const files = [{ filename: 'README.md', patch: '+ hello' }];
    const result = matchRules([timeoutRule, cacheRule], files);
    expect(result).toEqual([]);
  });

  test('handles missing patch gracefully', () => {
    const files = [{ filename: 'README.md' }];
    const result = matchRules([timeoutRule], files);
    expect(result).toEqual([]);
  });

  test('handles empty paths array', () => {
    const files = [{ filename: 'anything.js', patch: '+timeout=5' }];
    const result = matchRules([timeoutRule], files);
    expect(result).toEqual([timeoutRule]);
  });
});

describe('buildChecklist', () => {
  test('builds markdown with signature', () => {
    const result = buildChecklist([timeoutRule]);
    expect(result).toContain('<!-- resilience-review-action -->');
    expect(result).toContain('## Resilience Review');
    expect(result).toContain('### Timeout Values');
    expect(result).toContain('- [ ] Check upstream timeout');
    expect(result).toContain('- [ ] Check p99 latency');
  });

  test('includes multiple rules', () => {
    const result = buildChecklist([timeoutRule, cacheRule]);
    expect(result).toContain('### Timeout Values');
    expect(result).toContain('### Cache Configuration');
  });

  test('includes footer', () => {
    const result = buildChecklist([timeoutRule]);
    expect(result).toContain('resilience-review-action');
  });
});
