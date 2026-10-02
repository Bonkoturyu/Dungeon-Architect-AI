import { runLocal } from './start-local-runtime.mjs';

try {
  process.exitCode = await runLocal();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
