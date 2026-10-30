import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const gitignore = readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8');

// 実データや利用者のgit設定を読まず、空の隔離repoへパス文字列だけを渡す。
function ignoredPaths(paths) {
  const directory = mkdtempSync(join(tmpdir(), 'dai-gitignore-test-'));
  try {
    writeFileSync(join(directory, '.gitignore'), gitignore);
    const emptyConfig = join(directory, 'empty-git-config');
    writeFileSync(emptyConfig, '');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    env.GIT_CONFIG_NOSYSTEM = '1';
    env.GIT_CONFIG_GLOBAL = emptyConfig;
    const runGit = (args, input) => {
      const result = spawnSync('git', ['-c', `core.excludesFile=${emptyConfig}`, ...args], {
        cwd: directory, env, input, encoding: 'utf8',
      });
      assert.ifError(result.error);
      assert.ok([0, 1].includes(result.status), result.stderr);
      return result;
    };
    assert.equal(runGit(['init', '--quiet', '--template=']).status, 0);
    const result = runGit(['check-ignore', '--no-index', '-z', '--stdin'], paths.join('\0') + '\0');
    return new Set(result.stdout.split('\0').filter(Boolean));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('Claude project-local settings, credentials and runtime data remain ignored', () => {
  const local = [
    'settings.local.json', 'settings.local.json.bak', '.credentials.json', '.credentials.json.bak',
    '.claude.json', 'history.jsonl', 'projects/example/session.jsonl', 'file-history/example/snapshot',
    'debug/example.txt', 'logs/example.txt', 'cache/example', 'paste-cache/example', 'image-cache/example',
    'session-env/example', 'shell-snapshots/example.sh', 'backups/example', 'sessions/example',
    'tasks/example', 'todos/example', 'plans/example.md', 'uploads/example', 'feedback/drafts/example',
    'feedback-bundles/example', 'usage-data/example', 'stats-cache.json', 'worktrees/example/file.js',
  ];
  const paths = local.flatMap((path) => [`.claude/${path}`, `nested/.claude/${path}`]);
  paths.push('CLAUDE.local.md', 'nested/CLAUDE.local.md');
  assert.deepEqual(ignoredPaths(paths), new Set(paths));
});

test('Claude shared project configuration, hooks and skills remain visible', () => {
  const shared = [
    'settings.json', 'hooks/pre-tool.sh', 'skills/example/SKILL.md', 'commands/example.md',
    'agents/reviewer.md', 'rules/testing.md', 'agent-memory/reviewer/MEMORY.md', 'launch.json',
  ];
  const paths = shared.flatMap((path) => [`.claude/${path}`, `nested/.claude/${path}`]);
  paths.push('CLAUDE.md', '.env.example');
  assert.deepEqual(ignoredPaths(paths), new Set());
});

test('existing secrets, private evidence and build-cache exclusions remain intact', () => {
  const paths = [
    '.env', '.env.production', '.dev.vars', '.dev.vars.local', 'example.pem', 'example.key',
    'example.p12', 'example.pfx', '.claude/.env', '.claude/example.key',
    'private/example.txt', 'docs/legal/evidence/private/example.txt', 'docs/registration/private/example.txt',
    'artifacts/example.txt', 'node_modules/example/index.js', 'dist/example.js', '.cache/example', '.tmp/example',
  ];
  assert.deepEqual(ignoredPaths(paths), new Set(paths));
});

test('DEV-003 consistently discloses browser smoke script purpose, output and inclusion', () => {
  const register = readFileSync(new URL('../../docs/legal/AI_USAGE.md', import.meta.url), 'utf8');
  const rows = register.split('\n').filter((line) => line.startsWith('| PROD-AI-DEV-003 |'));
  assert.equal(rows.length, 1);
  const cells = rows[0].split('|').slice(1, -1).map((cell) => cell.trim());
  assert.equal(cells.length, 10);
  assert.match(cells[3], /ブラウザsmoke script/);
  assert.match(cells[5], /browser smoke scripts/);
  assert.match(cells[8], /browser smoke scripts/);
  assert.match(cells[8], /private chats\/audit records excluded/);
});
