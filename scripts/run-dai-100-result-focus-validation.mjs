import { spawnSync } from 'node:child_process';

const steps = [
  { label: 'Production hosting build', command: 'npm', args: ['run', 'build:hosting'] },
  { label: 'Result / camera-focus visible-Chrome smoke', command: 'npm', args: ['run', 'smoke:dai-100-result-focus'] },
  { label: 'Event feedback regression smoke', command: 'npm', args: ['run', 'smoke:dai-100-event-feedback'] },
  { label: 'Character motion regression smoke', command: 'npm', args: ['run', 'smoke:programmatic-characters'] },
  { label: 'Motion / feedback regression smoke', command: 'npm', args: ['run', 'smoke:dai-100-motion-feedback'] },
  { label: 'Owner UI regression smoke', command: 'npm', args: ['run', 'smoke:owner-ui-review'] },
  { label: 'Syntax validation', command: 'npm', args: ['run', 'validate:syntax'] },
  { label: 'Git whitespace / error-marker check', command: 'git', args: ['diff', '--check', 'origin/main...HEAD'] },
];

const results = [];

for (const [index, step] of steps.entries()) {
  process.stdout.write(
    `\n[DAI-100 RESULT FOCUS] ${index + 1}/${steps.length} ${step.label}\n\n`,
  );

  let executable = step.command;
  let args = step.args;
  if (step.command === 'npm') {
    if (!process.env.npm_execpath) throw new Error('Run through npm run.');
    executable = process.execPath;
    args = [process.env.npm_execpath, ...step.args];
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
    error: result.error?.message ?? null,
  });

  if (!passed) {
    console.error(JSON.stringify({
      passed: false,
      falseChecks: [step.label],
      phase: 'result-transition-camera-focus',
      results,
    }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({
  passed: true,
  falseChecks: [],
  phase: 'result-transition-camera-focus',
  results,
}, null, 2));
