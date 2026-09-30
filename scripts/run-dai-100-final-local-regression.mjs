import { spawnSync } from 'node:child_process';

const steps = [
  {
    label: 'Full Node regression suite',
    command: 'npm',
    args: ['test'],
  },
  {
    label: 'Multi-floor simulation regression',
    command: 'npm',
    args: ['run', 'validate:run-simulation'],
  },
  {
    label: 'Production hosting build',
    command: 'npm',
    args: ['run', 'build:hosting'],
  },
  {
    label: 'Browser performance regression',
    command: 'npm',
    args: ['run', 'smoke:browser-performance'],
  },
  {
    label: 'Owner UI regression smoke',
    command: 'npm',
    args: ['run', 'smoke:owner-ui-review'],
  },
  {
    label: 'Room Event gameplay regression',
    command: 'npm',
    args: ['run', 'smoke:room-events'],
  },
  {
    label: 'Multi-floor browser regression',
    command: 'npm',
    args: ['run', 'smoke:multi-floor-run'],
  },
  {
    label: 'Programmatic character regression',
    command: 'npm',
    args: ['run', 'smoke:programmatic-characters'],
  },
  {
    label: 'Programmatic Audio V2 regression',
    command: 'npm',
    args: ['run', 'smoke:audio-presentation'],
  },
  {
    label: 'Motion feedback regression',
    command: 'npm',
    args: ['run', 'smoke:dai-100-motion-feedback'],
  },
  {
    label: 'Event feedback regression',
    command: 'npm',
    args: ['run', 'smoke:dai-100-event-feedback'],
  },
  {
    label: 'Result / camera-focus regression',
    command: 'npm',
    args: ['run', 'smoke:dai-100-result-focus'],
  },
  {
    label: 'DesignIntent atmosphere regression',
    command: 'npm',
    args: ['run', 'smoke:dai-100-atmosphere'],
  },
  {
    label: 'AI Edit V3 structural regression',
    command: 'npm',
    args: ['run', 'smoke:dai-100-ai-edit-structural'],
  },
  {
    label: 'Reactive Audio V2 regression',
    command: 'npm',
    args: ['run', 'smoke:dai-100-reactive-audio'],
  },
  {
    label: 'JSON Export regression',
    command: 'npm',
    args: ['run', 'smoke:dai-100-json-export'],
  },
  {
    label: 'JSON Import / round-trip regression',
    command: 'npm',
    args: ['run', 'smoke:dai-100-json-import'],
  },
  {
    label: 'Ten-strategy Generator selector regression',
    command: 'npm',
    args: ['run', 'smoke:dai-100-generator-strategy-selector'],
  },
  {
    label: 'Legal / provenance audit',
    command: 'npm',
    args: ['run', 'validate:legal-registers'],
  },
  {
    label: 'Secret / privacy audit',
    command: 'npm',
    args: ['run', 'validate:secret-privacy'],
  },
  {
    label: 'Public docs truthfulness audit',
    command: 'npm',
    args: ['run', 'validate:public-docs'],
  },
  {
    label: 'Submission metadata audit',
    command: 'npm',
    args: ['run', 'validate:submission-metadata'],
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
    '\n[DAI-100 FINAL LOCAL] ' +
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

  const result = spawnSync(
    executable,
    args,
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  const passed =
    result.status === 0 &&
    !result.error;

  results.push({
    label: step.label,
    passed,
    status: result.status ?? null,
    error:
      result.error?.message ?? null,
  });

  if (!passed) {
    console.error(
      JSON.stringify(
        {
          passed: false,
          failedStep: step.label,
          falseChecks: [step.label],
          phase:
            'dai-100-final-local-regression',
          excludes: [
            'owner audio listening review',
            'public deployment smoke',
            'live-provider semantic verification',
            'DAI-090 Final',
            'final video capture/review',
            'freeze/rollback creation',
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
      phase:
        'dai-100-final-local-regression',
      excludes: [
        'owner audio listening review',
        'public deployment smoke',
        'live-provider semantic verification',
        'DAI-090 Final',
        'final video capture/review',
        'freeze/rollback creation',
      ],
      results,
    },
    null,
    2,
  ),
);
