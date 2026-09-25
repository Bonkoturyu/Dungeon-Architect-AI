import { spawnSync } from 'node:child_process';

const steps = [
  { label: 'Audio presentation unit tests', command: 'npm', args: ['run', 'test:audio'] },
  { label: 'DAI-097/100 audio browser smoke', command: 'npm', args: ['run', 'smoke:audio-presentation'] },
  { label: 'Owner UI regression smoke', command: 'npm', args: ['run', 'smoke:owner-ui-review'] },
  { label: 'Production hosting build', command: 'npm', args: ['run', 'build:hosting'] },
  { label: 'Legal / provenance audit', command: 'npm', args: ['run', 'validate:legal-registers'] },
  { label: 'Git whitespace / error-marker check', command: 'git', args: ['diff', '--check', 'origin/main...HEAD'] },
];

const results = [];

for (const [index, step] of steps.entries()) {
  console.log(`[DAI-100 AUDIO] ${index + 1}/${steps.length} ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const passed = result.status === 0 && !result.error;
  results.push({ label: step.label, passed, status: result.status ?? null });
  if (!passed) {
    console.error(JSON.stringify({ passed: false, failedStep: step.label, results }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({
  passed: true,
  falseChecks: [],
  results,
}, null, 2));
