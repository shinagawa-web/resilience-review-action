# resilience-review-action

A GitHub Action that automatically reviews pull requests for resilience risks.

When a PR is opened, this Action reads the changed files and diff, matches them against a built-in ruleset, and posts a checklist comment to help reviewers catch issues before they reach production.

## What it checks

| Category | Triggers on | Example risk |
|---|---|---|
| Cache Configuration | `ttl`, `expire`, `redis.conf`, `*cache*` | Serving stale data when cache backend goes down |
| Concurrency / Worker Count | `workers`, `pool_size`, `gunicorn*`, `celery*` | DB connection pool exhaustion |
| Health Check | `liveness`, `readiness`, `Dockerfile`, `k8s/*.yaml` | Health check passing when the app can't handle requests |
| Monitoring Thresholds | `threshold`, `alarm`, `*datadog*`, `*cloudwatch*` | Incidents no longer detected after threshold is relaxed |
| Instance Type | `instance_type`, `spot`, `*.tf` | No failover path after switching to Spot instances |
| Replica Count / AZ | `replicas`, `multi_az`, `desired_count` | Single point of failure after replica reduction |
| Timeout Values | `timeout`, `connect_timeout`, `read_timeout` | Timeout misalignment between upstream and downstream |

## Usage

Add the following file to your repository:

```yaml
# .github/workflows/resilience-review.yml
on: [pull_request]

jobs:
  resilience-review:
    runs-on: ubuntu-latest
    steps:
      - uses: shinagawa-web/resilience-review-action@v1
```

That's it. No configuration needed. The ruleset is built in.

## How it works

1. A pull request is opened
2. This Action reads the changed file paths and diff
3. Changed files are matched against the built-in `rules.yml`
4. If any category is triggered, a single PR comment is posted with the relevant checklist

## Example PR comment

> **Resilience Review**
>
> The following changes may affect system resilience. Please review before merging.
>
> **Timeout Values**
> - [ ] If increasing timeout, is it still shorter than the upstream caller's timeout?
> - [ ] If decreasing timeout, is p99 response time comfortably below the new timeout value?
> - [ ] Is there a retry policy for timeout failures?
>
> **Replica Count / AZ Configuration**
> - [ ] If reducing replicas, can the service remain available when one instance fails?
> - [ ] Is the deployment spread across multiple AZs?

## Options

| Input | Description | Default |
|---|---|---|
| `github-token` | GitHub token for posting PR comments | `${{ github.token }}` |
| `output` | Where to post the checklist: `comment` or `pr-body` | `comment` |
| `locale` | Language for the checklist: `en` or `ja` | `en` |
| `rules-path` | Path to a custom rules YAML file (requires `actions/checkout`) | Built-in ruleset |

### Post checklist to PR description instead of a comment

```yaml
- uses: shinagawa-web/resilience-review-action@v1
  with:
    output: pr-body
```

### Use Japanese checklist

```yaml
- uses: shinagawa-web/resilience-review-action@v1
  with:
    locale: ja
```

### Use a custom ruleset

By default, the built-in `rules.yml` is used. To use your own ruleset, check out the repository first and pass a `rules-path` input:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: shinagawa-web/resilience-review-action@v1
    with:
      rules-path: .github/resilience-rules.yml
```

## License

MIT
