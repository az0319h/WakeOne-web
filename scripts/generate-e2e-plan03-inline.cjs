const fs = require('fs');
const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const creds = {
  adminEmail: env.E2E_ADMIN_EMAIL,
  adminPassword: env.E2E_ADMIN_PASSWORD,
  userEmail: env.E2E_USER_EMAIL,
  userPassword: env.E2E_USER_PASSWORD
};
const base = env.E2E_BASE_URL || 'http://localhost:3000';
const code = fs
  .readFileSync('scripts/e2e-plan03-template.js', 'utf8')
  .replace('__CREDS__', JSON.stringify(creds))
  .replace('__BASE__', JSON.stringify(base));
fs.writeFileSync('scripts/e2e-plan03-inline.js', code);
