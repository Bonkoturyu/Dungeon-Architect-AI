import { spawnSync } from 'node:child_process';

const steps = [
  {
    label: 'Programmatic Audio unit tests',
    command: 'npm',
    args: ['run', 'test:audio'],
  },
  {
    label: 'Programmatic Audio browser smoke',
    command: 'npm',
    args: ['run', 'smoke:audio-presentation'],
  },
  {
    label: 'Reactive Audio browser smoke',
    command: 'npm',
    args: ['run', 'smoke:dai-100-reactive-audio'],
  },
  {
    label: 'Owner UI grouped-details regression',
    command: 'npm',
    args: ['run', 'smoke:owner-ui-review'],
  },
  {
    label: 'UI/UX spatial-exit regression',
    command: 'npm',
    args: ['run', 'smoke:ui-ux-polish'],
  },
  {
    label: 'Production hosting build',
    command: 'npm',
    args: ['run', 'build:hosting'],
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
    '\n[DAI-100 OWNER POLISH] ' +
      (index + 1) +
      '/' +
      steps.length +
      ' ' +
      step.label +
      '\n\n',
  );

  let executable = step.command;
  let args = step.args;

  if (step.command === 'npm') {
    if (!process.env.npm_execpath) {
      throw new Error('Run through npm run.');
    }
    executable = process.execPath;
    args = [process.env.npm_execpath, ...step.args];
  }

  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });

  const passed =
    result.status === 0 &&
    !result.error;

  results.push({
    label: step.label,
    passed,
    status: result.status ?? null,
    error: result.error?.message ?? null,
  });

  if (!passed) {
    console.error(
      JSON.stringify(
        {
          passed: false,
          failedStep: step.label,
          falseChecks: [step.label],
          phase: 'dai-100-owner-polish',
          scope: [
            'continuous BGM loop',
            'spatial multi-exit disambiguation',
            'grouped viewport details',
          ],
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
      phase: 'dai-100-owner-polish',
      scope: [
        'continuous BGM loop',
        'spatial multi-exit disambiguation',
        'grouped viewport details',
      ],
      results,
    },
    null,
    2,
  ),
);
