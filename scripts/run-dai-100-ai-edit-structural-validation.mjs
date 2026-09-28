import { spawnSync } from 'node:child_process';

const steps = [
  {
    label: 'Cloud-intent structural contract tests',
    command: 'npm',
    args: ['run', 'test:cloud-intent'],
  },
  {
    label: 'Editor Core structural command tests',
    command: 'npm',
    args: ['run', 'test:editor'],
  },
  {
    label: 'Hosting Function tests',
    command: 'npm',
    args: ['run', 'test:hosting'],
  },
  {
    label: 'AI Edit V2 five-command regression smoke',
    command: 'npm',
    args: ['run', 'smoke:dai-100-ai-edit-v2'],
  },
  {
    label: 'AI Edit structural visible-Chrome smoke',
    command: 'npm',
    args: ['run', 'smoke:dai-100-ai-edit-structural'],
  },
  {
    label: 'Production hosting build',
    command: 'npm',
    args: ['run', 'build:hosting'],
  },
  {
    label: 'Secret / privacy re-audit',
    command: 'npm',
    args: ['run', 'validate:secret-privacy'],
  },
  {
    label: 'Owner UI regression smoke',
    command: 'npm',
    args: ['run', 'smoke:owner-ui-review'],
  },
  {
    label: 'Syntax validation',
    command: 'npm',
    args: ['run', 'validate:syntax'],
  },
  {
    label: 'Git whitespace / error-marker check',
    command: 'git',
    args: ['diff', '--check', 'origin/main...HEAD'],
  },
];

const results = [];

for (const [index, step] of steps.entries()) {
  process.stdout.write(
    `\n[DAI-100 AI EDIT STRUCTURAL] ${index + 1}/${steps.length} ${step.label}\n\n`,
  );

  let executable = step.command;
  let args = step.args;

  if (step.command === 'npm') {
    const npmExecPath = process.env.npm_execpath;
    if (!npmExecPath) {
      throw new Error(
        'npm_execpath is unavailable; run this validator through npm run.',
      );
    }
    executable = process.execPath;
    args = [npmExecPath, ...step.args];
  }

  const result = spawnSync(executable, args, {
    stdio: 'inherit',
    windowsHide: true,
  });
  const passed = result.status === 0 && !result.error;
  results.push({
    label: step.label,
    passed,
    status: result.status ?? null,
    error: result.error?.message ?? null,
  });

  if (!passed) {
    console.error(JSON.stringify({
      passed: false,
      failedStep: step.label,
      falseChecks: [step.label],
      phase: 'ai-edit-structural-v3',
      results,
    }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({
  passed: true,
  falseChecks: [],
  phase: 'ai-edit-structural-v3',
  results,
}, null, 2));
