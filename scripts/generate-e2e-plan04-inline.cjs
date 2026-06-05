const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const env = {};
fs.readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  });

const { createClient } = require('@supabase/supabase-js');

async function resolveUserId() {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data.users.find((u) => u.email === env.E2E_USER_EMAIL);
  if (!user) {
    throw new Error(`E2E_USER_EMAIL not found: ${env.E2E_USER_EMAIL}`);
  }
  return user.id;
}

async function main() {
  const userId = await resolveUserId();
  const creds = {
    adminEmail: env.E2E_ADMIN_EMAIL || 'wakeone@gmail.com',
    adminPassword: env.E2E_ADMIN_PASSWORD,
    userEmail: env.E2E_USER_EMAIL,
    userPassword: env.E2E_USER_PASSWORD,
    userId
  };

  const template = fs.readFileSync(path.join(__dirname, 'e2e-plan04-template.js'), 'utf8');
  const inline = template.replace('__CREDS__', JSON.stringify(creds));
  fs.writeFileSync(path.join(__dirname, 'e2e-plan04-inline.js'), inline);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
