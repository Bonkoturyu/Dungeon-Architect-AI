import crypto from 'node:crypto';
import fs from 'node:fs';

const validSha256 = (value) => /^[0-9a-f]{64}$/.test(value ?? '');

export function sameBuildSource(actual, expected) {
  return /^[0-9a-f]{40}$/.test(expected?.commitSha ?? '')
    && validSha256(expected?.runtimeSourceSha256)
    && ['commitSha', 'runtimeSourceSha256'].every((key) => actual?.[key] === expected[key]);
}

export function sameBuildFingerprint(actual, expected) {
  return sameBuildSource(actual, expected) && validSha256(expected?.runtimeBundleSha256)
    && actual?.runtimeBundleSha256 === expected.runtimeBundleSha256;
}

// OS間のbundle差分は診断値。録画は公開E2Eで検証した実際のdeploymentに固定する。
export function validateRecordingCandidate({ baseUrl, candidateBuild, publicEvidence }) {
  const remote = publicEvidence?.buildFingerprint?.remote;
  return publicEvidence?.passed === true && publicEvidence.publicUrl === baseUrl
    && baseUrl.startsWith('https://') && sameBuildSource(remote, candidateBuild)
    && sameBuildFingerprint(remote, remote);
}

export async function fetchRecordingBuild(baseUrl, expectedBuild, fetchImpl = fetch) {
  const response = await fetchImpl(new URL('/build-info.json', baseUrl), {
    cache: 'no-store', headers: { 'cache-control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`Recording build-info HTTP ${response.status}`);
  const value = await response.json();
  if (!sameBuildFingerprint(value, expectedBuild)) {
    throw new Error('Recording deployment differs from the validated public candidate.');
  }
  return value;
}

export function captureFileState(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return { sizeBytes: stat.size, modifiedAtMs: stat.mtimeMs,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex') };
}

// 手動録画も同じ実ファイル検査を通す。過去のMP4とinteractionのみでは合格しない。
export function validateCapture({ before, after, startedAtMs, probe }) {
  const checks = {
    actualCaptureCreated: Boolean(after && after.sizeBytes > 0 && validSha256(after.sha256)),
    actualCaptureFresh: Boolean(after && Number.isFinite(startedAtMs)
      && after.modifiedAtMs >= startedAtMs && after.sha256 !== before?.sha256),
    actualCaptureProbed: Boolean(probe && probe.sizeBytes === after?.sizeBytes
      && probe.formatName?.split(',').includes('mp4')
      && probe.streams?.some((stream) => stream.codec_type === 'video')),
    actualCaptureUnder180Seconds: Boolean(probe && Number.isFinite(probe.durationSeconds)
      && probe.durationSeconds > 0 && probe.durationSeconds < 180),
  };
  return { checks, passed: Object.values(checks).every((value) => value === true) };
}

export function validateFreezeEvidence({ buildInfo, runtimeBundleSha256, runtimeSourceSha256, videoRun, videoState,
  publicDocs, publicEvidence }) {
  const remote = publicEvidence?.buildFingerprint?.remote;
  const capture = videoRun?.recordingBoundary;
  return {
    localRuntimeSourceRecomputes: validSha256(buildInfo?.runtimeSourceSha256)
      && buildInfo.runtimeSourceSha256 === runtimeSourceSha256,
    localRuntimeBundleRecomputes: validSha256(buildInfo?.runtimeBundleSha256)
      && buildInfo.runtimeBundleSha256 === runtimeBundleSha256,
    publicDocsAuditPassed: publicDocs?.passed === true,
    videoRunPassed: videoRun?.passed === true,
    videoCaptureValidated: capture?.actualVideoFileValidated === true
      && validateCapture({ before: capture?.captureBefore, after: capture?.captureFile,
        startedAtMs: capture?.captureStartedAtMs, probe: capture?.captureProbe }).passed,
    videoCaptureMatchesValidatedFile: validSha256(videoState?.sha256)
      && capture?.captureFile?.sha256 === videoState.sha256
      && capture?.captureFile?.sizeBytes === videoState.sizeBytes,
    videoBuildMatchesCandidate: validateRecordingCandidate({ baseUrl: videoRun?.publicUrl ?? '',
      candidateBuild: buildInfo, publicEvidence })
      && sameBuildFingerprint(videoRun?.buildFingerprint?.start, remote)
      && sameBuildFingerprint(videoRun?.buildFingerprint?.end, remote),
  };
}
