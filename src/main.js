const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { minimatch } = require('minimatch');

const SIGNATURE = '<!-- resilience-review-action -->';

async function run() {
  try {
    const token = core.getInput('github-token');
    const output = core.getInput('output') || 'comment';
    const locale = core.getInput('locale') || 'en';

    // Resolve rules file: custom path > locale-specific built-in > default built-in
    let rulesPath = core.getInput('rules-path');
    if (!rulesPath) {
      const localeFile = locale === 'ja' ? 'rules.ja.yml' : 'rules.yml';
      rulesPath = path.join(__dirname, '..', localeFile);
    }

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

    // Get all changed files with pagination
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number,
      per_page: 100,
    });

    // Match rules against changed files
    const triggered = matchRules(rules, files);

    if (triggered.length === 0) {
      core.info('No resilience risks detected.');
      return;
    }

    // Build checklist body
    const body = buildChecklist(triggered);

    if (output === 'pr-body') {
      await postToPrBody(octokit, owner, repo, pull_number, body);
    } else {
      await postAsComment(octokit, owner, repo, pull_number, body);
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

function matchRules(rules, files) {
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

  return triggered;
}

function buildChecklist(triggered) {
  const lines = [
    SIGNATURE,
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

  return lines.join('\n');
}

async function postAsComment(octokit, owner, repo, pull_number, body) {
  // Find existing comment by signature
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pull_number,
    per_page: 100,
  });

  const existing = comments.find(c => c.body && c.body.includes(SIGNATURE));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    core.info('Resilience review comment updated.');
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body,
    });
    core.info('Resilience review comment posted.');
  }
}

async function postToPrBody(octokit, owner, repo, pull_number, body) {
  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number });
  const existingBody = pr.body || '';

  // Replace existing section or append
  let newBody;
  const signatureIndex = existingBody.indexOf(SIGNATURE);
  if (signatureIndex !== -1) {
    newBody = existingBody.substring(0, signatureIndex).replace(/\n*---\n*$/, '') + '\n\n---\n\n' + body;
    core.info('Resilience review section updated in PR body.');
  } else {
    const separator = existingBody.trim() ? '\n\n---\n\n' : '';
    newBody = existingBody + separator + body;
    core.info('Resilience review section appended to PR body.');
  }

  await octokit.rest.pulls.update({
    owner,
    repo,
    pull_number,
    body: newBody,
  });
}

module.exports = { matchRules, buildChecklist };

run();
