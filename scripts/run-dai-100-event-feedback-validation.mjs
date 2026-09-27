import { spawnSync } from 'node:child_process';

const steps = [
  {
    label: 'Production hosting build',
    command: 'npm',
    args: ['run', 'build:hosting'],
  },
  {
    label: 'Event feedback visible-Chrome smoke',
    command: 'npm',
    args: ['run', 'smoke:dai-100-event-feedback'],
  },
  {
    label: 'Room event gameplay regression smoke',
    command: 'npm',
    args: ['run', 'smoke:room-events'],
  },
  {
    label: 'Motion / feedback regression smoke',
    command: 'npm',
    args: ['run', 'smoke:dai-100-motion-feedback'],
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
    `\n[DAI-100 EVENT FEEDBACK] ${index + 1}/${steps.length} ${step.label}\n\n`,
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
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });

  const passed = result.status === 0 && !result.error;
  results.push({
    label: step.label,
    passed,
    status: result.status ?? null,
    error: result.error
      ? {
          name: result.error.name,
          code: result.error.code ?? null,
          message: result.error.message,
        }
      : null,
  });

  if (!passed) {
    console.error(JSON.stringify({
      passed: false,
      failedStep: step.label,
      falseChecks: [step.label],
      phase: 'event-feedback-presentation',
      results,
    }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({
  passed: true,
  falseChecks: [],
  phase: 'event-feedback-presentation',
  results,
}, null, 2));
