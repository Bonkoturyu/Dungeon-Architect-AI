import { spawnSync } from 'node:child_process';

const steps = [
  {
    label: 'Delaunay MST reusable Core tests',
    command: 'npm',
    args: ['run', 'test:generator-delaunay-mst'],
  },
  {
    label: 'Generator / Algorithm Lab adapter tests',
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

for (let index = 0; index < steps.length; index += 1) {
  const step = steps[index];
  process.stdout.write(
    `\n[DAI-100 DELAUNAY MST] ${index + 1}/${steps.length} ${step.label}\n\n`,
  );

  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const passed = result.status === 0;
  results.push({
    label: step.label,
    passed,
    status: result.status,
    error: result.error ? String(result.error) : null,
  });

  if (!passed) {
    console.log(JSON.stringify({
      passed: false,
      falseChecks: [step.label],
      results,
    }, null, 2));
    process.exit(result.status || 1);
  }
}

console.log(JSON.stringify({
  passed: true,
  falseChecks: [],
  phase: 'algorithm-lab-delaunay-mst-core',
  registeredInProductSelector: false,
  results,
}, null, 2));
