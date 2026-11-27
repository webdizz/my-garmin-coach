// Fails when src/db/schema.ts differs from the committed migrations, i.e. `db:generate` would
// write a new migration. Runs drizzle-kit inside a temp dir so the repo's drizzle/ is never written.
// Requires drizzle-kit's explicit "No schema changes" line: anything else (including a silent
// no-op) is treated as a failure, so the check cannot pass by accident.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const drizzleKit = path.join(root, 'node_modules/.bin/drizzle-kit');
const schema = path.join(root, 'src/db/schema.ts');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-drizzle-drift-'));

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

try {
  fs.cpSync(path.join(root, 'drizzle'), path.join(tmp, 'drizzle'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, 'drizzle.check.config.mjs'),
    `export default { dialect: 'sqlite', schema: ${JSON.stringify(schema)}, out: './drizzle' };\n`
  );

  const run = spawnSync(drizzleKit, ['generate', '--config', 'drizzle.check.config.mjs'], {
    cwd: tmp,
    encoding: 'utf8',
    input: '',
    timeout: 120_000,
  });
  const log = `${run.stdout ?? ''}${run.stderr ?? ''}`;

  if (run.status !== 0 || run.error) {
    fail('Drizzle drift check failed to run.');
    console.error(log.trim());
  } else if (/No schema changes/i.test(log)) {
    console.log('✅ No schema drift: migrations match src/db/schema.ts.');
  } else {
    fail('Schema drift: db:generate would create a new migration.');
    console.error('   Run `npm run db:generate` and commit the migration with the schema change.');
    console.error(log.trim());
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
