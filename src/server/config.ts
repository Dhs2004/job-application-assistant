import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadLocalEnv(): void {
  const file = resolve(process.cwd(), '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
}

loadLocalEnv();

export const config = {
  port: Number(process.env.PORT ?? 4317),
  dataDir: resolve(process.cwd(), '.data'),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
};

export function smtpConfigured(): boolean {
  return Boolean(config.smtp.host && config.smtp.port && config.smtp.user && config.smtp.pass && config.smtp.from);
}
