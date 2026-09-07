import { timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ByteDanceModel } from '../shared/types.js';

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
  dataDir: resolve(process.env.JOB_ASSISTANT_DATA_DIR ?? '.data'),
  localAccessPassword: process.env.APP_ACCESS_PASSWORD ?? '',
  byteDanceKeys: {
    [ByteDanceModel.Terra]: splitKeys(process.env.BYTEDANCE_GPT_5_6_TERRA_KEYS),
    [ByteDanceModel.Sol]: splitKeys(process.env.BYTEDANCE_GPT_5_6_SOL_KEYS),
    [ByteDanceModel.Gpt55]: splitKeys(process.env.BYTEDANCE_GPT_5_5_KEYS),
  },
};

const keyCursor = new Map<ByteDanceModel, number>();

/** Returns the next local key only after a constant-time password check. */
export function resolveByteDanceKey(model: ByteDanceModel, password: string): string {
  if (!safeEqual(password, config.localAccessPassword)) throw new Error('访问密码错误或本机 Key 池未配置');
  const keys = config.byteDanceKeys[model];
  if (keys.length === 0) throw new Error('当前模型没有配置本地 Key');
  const cursor = keyCursor.get(model) ?? 0;
  keyCursor.set(model, cursor + 1);
  return keys[cursor % keys.length]!;
}

function splitKeys(value?: string): string[] {
  return value?.split(',').map((key) => key.trim()).filter(Boolean) ?? [];
}

function safeEqual(actual: string, expected: string): boolean {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
