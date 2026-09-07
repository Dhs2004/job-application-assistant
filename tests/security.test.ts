import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDedupeKey } from '../src/core/dedupe.js';
import { config, resolveByteDanceKey } from '../src/server/config.js';
import { SessionVault } from '../src/server/session-vault.js';
import type { DiscoveredJob, EmailDraft } from '../src/shared/types.js';
import { AiProviderKind, ByteDanceModel, ResumeFileType, SmtpPreset } from '../src/shared/types.js';
import { parseAndStoreResume } from '../src/server/resume.js';

const draft: EmailDraft = { to: 'jobs@example.com', subject: 'Application', body: 'A sufficiently long application body.', usedResumeFacts: ['TypeScript'] };

describe('secret and confirmation boundaries', () => {
  it('unlocks and rotates local model keys without returning them in status', () => {
    config.localAccessPassword = 'local-password';
    config.byteDanceKeys[ByteDanceModel.Sol] = ['first-test-key', 'second-test-key'];
    expect(() => resolveByteDanceKey(ByteDanceModel.Sol, 'wrong-password')).toThrow('访问密码错误');
    expect(resolveByteDanceKey(ByteDanceModel.Sol, 'local-password')).toBe('first-test-key');
    expect(resolveByteDanceKey(ByteDanceModel.Sol, 'local-password')).toBe('second-test-key');
  });

  it('keeps session credentials in memory and returns only masked status', () => {
    const vault = new SessionVault();
    vault.setAi({ kind: AiProviderKind.OpenAI, apiKey: 'secret-key', model: 'gpt-test' });
    vault.setSmtp({ preset: SmtpPreset.Gmail, email: 'candidate@example.com', password: 'secret-pass', fromName: 'Candidate' });
    expect(vault.getAiStatus()).toEqual({ connected: true, kind: AiProviderKind.OpenAI, model: 'gpt-test' });
    expect(vault.getSmtpStatus()).toEqual({ connected: true, email: 'ca***@example.com' });
    expect(JSON.stringify({ ...vault.getAiStatus(), ...vault.getSmtpStatus() })).not.toContain('secret');
  });

  it('consumes a confirmation once and rejects changed drafts', () => {
    const vault = new SessionVault();
    const token = vault.issueConfirmation('job-1', draft, 'resume.pdf');
    expect(() => vault.consumeConfirmation(token, 'job-1', { ...draft, subject: 'Changed' }, 'resume.pdf')).toThrow('改变');
    expect(() => vault.consumeConfirmation(token, 'job-1', draft, 'resume.pdf')).toThrow('失效');
  });
});

describe('resume and delivery identity', () => {
  it('accepts a valid TXT resume and stores only the controlled filename', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'job-assistant-test-'));
    const text = 'Frontend engineer with React, TypeScript, accessibility, and four years of product experience.';
    const result = await parseAndStoreResume({ fileName: 'my-resume.txt', mimeType: ResumeFileType.Text, dataBase64: Buffer.from(text).toString('base64') }, directory);
    expect(result.storedFileName).toBe('resume.txt');
    expect(readFileSync(join(directory, 'resume.txt'), 'utf8')).toBe(text);
  });

  it('creates a stable dedupe key for normalized job identity', () => {
    const job = { id: '1', company: 'Example', title: 'Engineer', applyEmail: 'jobs@example.com', sourceUrl: 'https://example.com/jobs/1' } as DiscoveredJob;
    expect(createDedupeKey(job)).toBe(createDedupeKey({ ...job, company: ' example ' }));
  });
});
