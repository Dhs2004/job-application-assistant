import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ResumeFileType } from '../src/shared/types.js';
import { assertSafeFeedUrl } from '../src/server/job-sources.js';
import { parseAndStoreResume } from '../src/server/resume.js';

describe('input security', () => {
  it('rejects local and private feed targets', async () => {
    await expect(assertSafeFeedUrl('https://localhost/jobs.json')).rejects.toThrow('本机');
    await expect(assertSafeFeedUrl('https://127.0.0.1/jobs.json')).rejects.toThrow('私有');
    await expect(assertSafeFeedUrl('http://8.8.8.8/jobs.json')).rejects.toThrow('HTTPS');
  });

  it('accepts a valid TXT resume and stores only the controlled filename', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'job-assistant-test-'));
    const text = 'Frontend engineer with React, TypeScript, accessibility, and four years of product experience.';
    const result = await parseAndStoreResume({ fileName: 'my-resume.txt', mimeType: ResumeFileType.Text, dataBase64: Buffer.from(text).toString('base64') }, directory);
    expect(result.storedFileName).toBe('resume.txt');
    expect(readFileSync(join(directory, 'resume.txt'), 'utf8')).toBe(text);
  });

  it('rejects extension and signature mismatches', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'job-assistant-test-'));
    await expect(parseAndStoreResume({ fileName: 'resume.txt', mimeType: ResumeFileType.Pdf, dataBase64: Buffer.from('not a pdf but long enough to parse').toString('base64') }, directory)).rejects.toThrow('扩展名');
  });
});
