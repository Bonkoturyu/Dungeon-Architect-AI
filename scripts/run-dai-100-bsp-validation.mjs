import { spawnSync } from 'node:child_process';

const steps = [
  {
    label: 'BSP reusable Core tests',
    command: 'npm',
    args: ['run', 'test:generator-bsp'],
  },
  {
    label: 'Generator / BSP Algorithm Lab adapter tests',
    command: 'npm',
    args: ['run', 'test:generator'],
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
    `\n[DAI-100 BSP] ${index + 1}/${steps.length} ${step.label}\n\n`,
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
    console.error(
      JSON.stringify(
        {
          passed: false,
          failedStep: step.label,
          falseChecks: [step.label],
          phase: 'algorithm-lab-bsp-core',
          registeredInProductSelector: false,
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
      phase: 'algorithm-lab-bsp-core',
      registeredInProductSelector: false,
      results,
    },
    null,
    2,
  ),
);
