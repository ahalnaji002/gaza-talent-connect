
const { spawnSync } = require('node:child_process');

const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString) {
  console.error('TEST_DATABASE_URL is required.');
  process.exit(1);
}

let databaseUrl;

try {
  databaseUrl = new URL(connectionString);
} catch {
  console.error('Invalid TEST_DATABASE_URL.');
  process.exit(1);
}

if (
  !['postgresql:', 'postgres:'].includes(databaseUrl.protocol) ||
  databaseUrl.pathname !== '/gaza_talent_connect_test'
) {
  console.error('Safety check failed: unexpected test database.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    '--experimental-vm-modules',
    './node_modules/jest/bin/jest.js',
    '--config',
    './test/jest-e2e.json',
    '--runInBand',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      NODE_ENV: 'test',
    },
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
