import { spawnSync } from 'node:child_process';

const steps = [
  {
    label: 'Audio presentation / reactive-intensity unit tests',
    command: 'npm',
    args: ['run', 'test:audio'],
  },
  {
    label: 'Existing DAI-097/100 audio regression smoke',
    command: 'npm',
    args: ['run', 'smoke:audio-presentation'],
  },
  {
    label: 'Reactive audio visible-Chrome smoke',
    command: 'npm',
    args: ['run', 'smoke:dai-100-reactive-audio'],
  },
  {
    label: 'Browser performance regression smoke',
    command: 'npm',
    args: ['run', 'smoke:browser-performance'],
  },
  {
    label: 'Owner UI regression smoke',
    command: 'npm',
    args: ['run', 'smoke:owner-ui-review'],
  },
  {
    label: 'Production hosting build',
    command: 'npm',
    args: ['run', 'build:hosting'],
  },
  {
    label: 'Legal / provenance audit',
    command: 'npm',
    args: ['run', 'validate:legal-registers'],
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
    `\n[DAI-100 REACTIVE AUDIO] ${index + 1}/${steps.length} ${step.label}\n\n`,
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
      phase: 'reactive-audio-v2-intensity',
      results,
    }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({
  passed: true,
  falseChecks: [],
  phase: 'reactive-audio-v2-intensity',
  results,
}, null, 2));
