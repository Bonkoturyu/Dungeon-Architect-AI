import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const outputDir = path.resolve('artifacts/dai-091');
const outputPath = path.join(outputDir, 'dai-091-pre-public-audit.json');

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  }).trim();
}

function isForbiddenTrackedPath(file) {
  const normalized = file.replaceAll('\\', '/');
  return (
    normalized === '.env' ||
    normalized.startsWith('.env.') ||
    normalized.startsWith('.dev.vars') ||
    normalized.startsWith('private/') ||
    normalized.startsWith('docs/legal/evidence/private/') ||
    normalized.startsWith('docs/registration/private/') ||
    normalized.startsWith('artifacts/') ||
    normalized.startsWith('node_modules/') ||
    normalized.startsWith('dist/')
  );
}

const riskyExtensions = new Set([
  '.pem', '.key', '.p12', '.pfx',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.pdf', '.zip', '.7z', '.rar',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp4', '.mov', '.avi', '.mkv',
  '.wav', '.mp3', '.ogg', '.flac',
]);

function riskyExtension(file) {
  return riskyExtensions.has(path.extname(file).toLowerCase());
}

const highConfidencePatterns = [
  { name: 'openai-api-key', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'github-token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g },
  { name: 'github-fine-grained-token', regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name: 'aws-access-key', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: 'google-api-key', regex: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { name: 'slack-token', regex: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g },
  { name: 'private-key-block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

const privacyPatterns = [
  { name: 'iban-like', regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { name: 'japanese-phone-like', regex: /\b0\d{1,4}-\d{1,4}-\d{3,4}\b/g },
  { name: 'japanese-postal-code-like', regex: /\b\d{3}-\d{4}\b/g },
  { name: 'windows-user-home', regex: /\b[A-Z]:\\Users\\[^\\\s]+/gi },
];

const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const allowedEmail = (email) => {
  const value = email.toLowerCase();
  return (
    value.endsWith('@users.noreply.github.com') ||
    value === 'noreply@github.com' ||
    value.endsWith('@example.com') ||
    value.endsWith('@example.org') ||
    value.endsWith('@example.net')
  );
};

function luhn(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (doubleDigit) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function redactFinding(name, file, extra = {}) {
  return { name, file, ...extra };
}

function scanText(text, file) {
  const secretFindings = [];
  const privacyFindings = [];
  const emailFindings = [];

  for (const pattern of highConfidencePatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(text)) {
      secretFindings.push(redactFinding(pattern.name, file));
    }
  }

  for (const pattern of privacyPatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(text)) {
      privacyFindings.push(redactFinding(pattern.name, file));
    }
  }

  const cardCandidates = text.match(/(?:\d[ -]?){13,19}/g) ?? [];
  if (cardCandidates.some((value) => luhn(value))) {
    privacyFindings.push(redactFinding('payment-card-like', file));
  }

  const emails = [...new Set(text.match(emailRegex) ?? [])];
  for (const email of emails) {
    if (!allowedEmail(email)) {
      emailFindings.push({
        name: 'non-noreply-email',
        file,
        domain: email.split('@').at(-1)?.toLowerCase() ?? null,
      });
    }
  }

  return { secretFindings, privacyFindings, emailFindings };
}

function parseHistoryPatch(text) {
  const secretFindings = [];
  const privacyFindings = [];
  const emailFindings = [];
  let commit = null;
  let file = null;

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('COMMIT:')) {
      commit = line.slice('COMMIT:'.length).trim();
      file = null;
      continue;
    }
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      file = match?.[2] ?? null;
      continue;
    }
    if (!line.startsWith('+') && !line.startsWith('-')) continue;
    if (line.startsWith('+++') || line.startsWith('---')) continue;

    const scanned = scanText(line.slice(1), file ?? '(unknown)');
    for (const finding of scanned.secretFindings) {
      secretFindings.push({ ...finding, commit });
    }
    for (const finding of scanned.privacyFindings) {
      privacyFindings.push({ ...finding, commit });
    }
    for (const finding of scanned.emailFindings) {
      emailFindings.push({ ...finding, commit });
    }
  }

  return { secretFindings, privacyFindings, emailFindings };
}

const branch = git(['branch', '--show-current']);
const trackedStatus = git(['status', '--porcelain', '--untracked-files=no']);
const trackedFiles = git(['ls-files', '-z'])
  .split('\0')
  .filter(Boolean);

const forbiddenTrackedPaths = trackedFiles.filter(isForbiddenTrackedPath);
const riskyTrackedFiles = trackedFiles.filter(riskyExtension);

const currentSecretFindings = [];
const currentPrivacyFindings = [];
const currentEmailFindings = [];

for (const file of trackedFiles) {
  if (riskyExtension(file)) continue;
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch {
    continue;
  }
  if (bytes.includes(0)) continue;
  const text = bytes.toString('utf8');
  const scanned = scanText(text, file);
  currentSecretFindings.push(...scanned.secretFindings);
  currentPrivacyFindings.push(...scanned.privacyFindings);
  currentEmailFindings.push(...scanned.emailFindings);
}

const metadataLines = git([
  'log',
  '--all',
  '--format=%H%x09%an%x09%ae%x09%cn%x09%ce',
])
  .split(/\r?\n/)
  .filter(Boolean);

const nonNoreplyCommitEmails = [];
for (const line of metadataLines) {
  const [commit, authorName, authorEmail, committerName, committerEmail] =
    line.split('\t');
  for (const [role, name, email] of [
    ['author', authorName, authorEmail],
    ['committer', committerName, committerEmail],
  ]) {
    if (email && !allowedEmail(email)) {
      nonNoreplyCommitEmails.push({
        commit,
        role,
        name,
        domain: email.split('@').at(-1)?.toLowerCase() ?? null,
      });
    }
  }
}

const historyPatch = execFileSync(
  'git',
  ['log', '--all', '-p', '--no-ext-diff', '--text', '--format=COMMIT:%H'],
  {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  },
);
const history = parseHistoryPatch(historyPatch);

const remoteRefs = git([
  'for-each-ref',
  '--format=%(refname:short)',
  'refs/remotes/origin',
])
  .split(/\r?\n/)
  .filter((ref) => ref && ref !== 'origin/HEAD');

const remoteBranchForbiddenPaths = [];
const remoteBranchRiskyFiles = [];
for (const ref of remoteRefs) {
  let files = [];
  try {
    files = git(['ls-tree', '-r', '--name-only', ref])
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    continue;
  }
  for (const file of files) {
    if (isForbiddenTrackedPath(file)) {
      remoteBranchForbiddenPaths.push({ ref, file });
    }
    if (riskyExtension(file)) {
      remoteBranchRiskyFiles.push({ ref, file });
    }
  }
}

function uniqueFindings(findings) {
  const seen = new Set();
  const result = [];
  for (const finding of findings) {
    const key = JSON.stringify(finding);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(finding);
  }
  return result;
}

const findings = {
  forbiddenTrackedPaths: [...new Set(forbiddenTrackedPaths)],
  riskyTrackedFiles: [...new Set(riskyTrackedFiles)],
  currentSecretFindings: uniqueFindings(currentSecretFindings),
  currentPrivacyFindings: uniqueFindings(currentPrivacyFindings),
  currentEmailFindings: uniqueFindings(currentEmailFindings),
  nonNoreplyCommitEmails: uniqueFindings(nonNoreplyCommitEmails),
  historySecretFindings: uniqueFindings(history.secretFindings),
  historyPrivacyFindings: uniqueFindings(history.privacyFindings),
  historyEmailFindings: uniqueFindings(history.emailFindings),
  remoteBranchForbiddenPaths: uniqueFindings(remoteBranchForbiddenPaths),
  remoteBranchRiskyFiles: uniqueFindings(remoteBranchRiskyFiles),
};

const checks = {
  runningFromDAI091VerificationBranch:
    branch === 'verify/dai-091-final-compliance-2026-09-25',
  trackedWorkingTreeClean:
    trackedStatus === '',
  noForbiddenTrackedPaths:
    findings.forbiddenTrackedPaths.length === 0,
  noRiskyTrackedBinaryOrDocumentFiles:
    findings.riskyTrackedFiles.length === 0,
  noHighConfidenceSecretsInCurrentTree:
    findings.currentSecretFindings.length === 0,
  noFinancialOrDirectPrivacyIdentifiersInCurrentTree:
    findings.currentPrivacyFindings.length === 0,
  noUnexpectedPersonalEmailsInCurrentTree:
    findings.currentEmailFindings.length === 0,
  commitMetadataUsesNoreplyAddressesOnly:
    findings.nonNoreplyCommitEmails.length === 0,
  noHighConfidenceSecretsInReachableHistory:
    findings.historySecretFindings.length === 0,
  noFinancialOrDirectPrivacyIdentifiersInReachableHistory:
    findings.historyPrivacyFindings.length === 0,
  noUnexpectedPersonalEmailsInReachableHistory:
    findings.historyEmailFindings.length === 0,
  noForbiddenPathsOnRemoteBranches:
    findings.remoteBranchForbiddenPaths.length === 0,
  noRiskyBinaryOrDocumentFilesOnRemoteBranches:
    findings.remoteBranchRiskyFiles.length === 0,
};

const falseChecks = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed: falseChecks.length === 0,
  checks,
  falseChecks,
  scope: {
    branch,
    trackedFileCount: trackedFiles.length,
    reachableCommitMetadataRows: metadataLines.length,
    remoteRefCount: remoteRefs.length,
    scansCurrentTrackedContent: true,
    scansReachableGitPatchHistory: true,
    scansCommitAuthorAndCommitterEmailMetadata: true,
    scansAllFetchedOriginBranchFilePaths: true,
    valuesRedactedFromEvidence: true,
  },
  findings,
  externalReviewBoundary: {
    pullRequestCommentsAreNotPartOfLocalGit:
      true,
    note:
      'PR/issue discussion must be reviewed separately before repository visibility changes.',
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  outputPath,
  JSON.stringify(evidence, null, 2) + '\n',
);

console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  throw new Error(
    'DAI-091 pre-public audit failed: ' + falseChecks.join(', '),
  );
}
