import { spawnSync } from 'node:child_process';

const steps = [
  {
    label: 'Cloud-intent unit tests',
    command: 'npm',
    args: ['run', 'test:cloud-intent'],
  },
  {
    label: 'Editor Core tests',
    command: 'npm',
    args: ['run', 'test:editor'],
  },
  {
    label: 'Hosting Function tests',
    command: 'npm',
    args: ['run', 'test:hosting'],
  },
  {
    label: 'AI Edit V2 browser smoke',
    command: 'node',
    args: ['scripts/run-dai-100-ai-edit-v2-smoke.mjs'],
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
  console.log(
    `[DAI-100 AI EDIT] ${index + 1}/${steps.length} ${step.label}`,
  );
  const executable =
    process.platform === 'win32' && step.command === 'npm'
      ? 'npm.cmd'
      : step.command;
  const result = spawnSync(executable, step.args, {
    stdio: 'inherit',
    windowsHide: true,
  });
  const passed = result.status === 0 && !result.error;
  results.push({
    label: step.label,
    passed,
    status: result.status ?? null,
  });
  if (!passed) {
    console.error(
      JSON.stringify(
        {
          passed: false,
          failedStep: step.label,
          results,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

console.log(
  JSON.stringify(
    {
      passed: true,
      falseChecks: [],
      results,
    },
    null,
    2,
  ),
);
