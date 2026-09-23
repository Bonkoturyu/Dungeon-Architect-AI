import { execFileSync, spawnSync } from "node:child_process";

const listed = execFileSync(
  "git",
  ["ls-files", "*.js", "*.mjs", "*.cjs"],
  { encoding: "utf8" },
);

const files = listed
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean)
  .sort();

const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    failures.push({
      file,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
}

const evidence = {
  checkedFiles: files.length,
  passed: failures.length === 0,
  failures,
};

console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  process.exitCode = 1;
}
