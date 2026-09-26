import { spawnSync } from 'node:child_process';

const steps = [
  {
    label: 'Generator strategy core tests',
    command: 'npm',
    args: ['run', 'test:generator-strategy-core'],
  },
  {
    label: 'Generator unit/versioning tests',
    command: 'npm',
    args: ['run', 'test:generator'],
  },
  {
    label: 'Generator V2 routeability matrix',
    command: 'node',
    args: ['scripts/run-dai-100-generator-v2-matrix.mjs'],
  },
  {
    label: 'Production hosting build',
    command: 'npm',
    args: ['run', 'build:hosting'],
  },
  {
    label: 'Owner UI regression smoke',
    command: 'npm',
    args: ['run', 'smoke:owner-ui-review'],
  },
  {
    label: 'Generator strategy selector smoke',
    command: 'npm',
    args: ['run', 'smoke:dai-100-generator-strategy-selector'],
  },
  {
    label: 'Generation surface browser smoke',
    command: 'npm',
    args: ['run', 'smoke:generation-surface'],
    env: { DAI_EXPECT_GENERATOR_VERSION: '2' },
  },
  {
    label: 'Exploration / Mystery browser smoke',
    command: 'npm',
    args: ['run', 'smoke:exploration-ux'],
  },
  {
    label: 'Multi-floor browser smoke',
    command: 'npm',
    args: ['run', 'smoke:multi-floor-run'],
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
]

for (const [index, step] of steps.entries()) {
  console.log(
    `[DAI-100 GENERATOR V2] ${index + 1}/${steps.length} ${step.label}`,
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
  } else if (step.command === 'node') {
    executable = process.execPath;
  }

  const result = spawnSync(executable, args, {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      ...(step.env ?? {}),
    },
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
