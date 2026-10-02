import { spawnSync } from 'node:child_process';

const steps = [
  {
    label: 'Cellular Automata reusable Core tests',
    command: 'npm',
    args: ['run', 'test:generator-cellular-automata'],
  },
  {
    label: 'Generator / Cellular Automata adapter tests',
    command: 'npm',
    args: ['run', 'test:generator'],
  },
  {
    label: 'Cellular Automata renderer routeability matrix',
    command: 'npm',
    args: ['run', 'validate:dai-100-cellular-automata-matrix'],
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
    label: 'Cellular Automata Product / multi-floor / Mystery browser smoke',
    command: 'npm',
    args: ['run', 'smoke:dai-100-cellular-automata'],
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
    '\n[DAI-100 CELLULAR AUTOMATA] ' +
      (index + 1) + '/' + steps.length +
      ' ' + step.label + '\n\n',
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
    result.status === 0 && !result.error;
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
      phase: 'algorithm-lab-cellular-automata',
      registeredInProductSelector: true,
      results,
    }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({
  passed: true,
  falseChecks: [],
  phase: 'algorithm-lab-cellular-automata',
  registeredInProductSelector: true,
  results,
}, null, 2));
