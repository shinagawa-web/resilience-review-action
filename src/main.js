const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { minimatch } = require('minimatch');

async function run() {
  try {
    const token = core.getInput('github-token');
    const rulesPath = core.getInput('rules-path') || path.join(__dirname, '..', 'rules.yml');

    const octokit = github.getOctokit(token);
    const context = github.context;

    if (!context.payload.pull_request) {
      core.info('Not a pull request event, skipping.');
      return;
    }

    const { owner, repo } = context.repo;
    const pull_number = context.payload.pull_request.number;

    // Load rules
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    const { rules } = yaml.load(rulesContent);

    // Get changed files (includes patch/diff per file)
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number,
      per_page: 100,
    });

    // Match rules against changed files
    const triggered = [];

    for (const rule of rules) {
      let matched = false;

      for (const file of files) {
        if (matched) break;

        const filename = file.filename;
        const patch = file.patch || '';

        // Check path patterns (filename or basename)
        const patterns = rule.triggers.paths || [];
        for (const pattern of patterns) {
          if (
            minimatch(filename, pattern, { matchBase: true }) ||
            minimatch(path.basename(filename), pattern, { matchBase: true })
          ) {
            matched = true;
            break;
          }
        }

        // Check keywords in diff
        if (!matched) {
          const keywords = rule.triggers.keywords || [];
          for (const keyword of keywords) {
            if (patch.includes(keyword)) {
              matched = true;
              break;
            }
          }
        }
      }

      if (matched) {
        triggered.push(rule);
      }
    }

    if (triggered.length === 0) {
      core.info('No resilience risks detected.');
      return;
    }

    // Build PR comment
    const lines = [
      '## Resilience Review',
      '',
      'The following changes may affect system resilience. Please review before merging.',
      '',
    ];

    for (const rule of triggered) {
      lines.push(`### ${rule.name}`);
      lines.push('');
      for (const item of rule.checklist) {
        lines.push(`- [ ] ${item}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('*Posted by [resilience-review-action](https://github.com/shinagawa-web/resilience-review-action)*');

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body: lines.join('\n'),
    });

    core.info(`Resilience review posted: ${triggered.map(r => r.name).join(', ')}`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
