import { describe, expect, it } from 'vitest';
import { AiProviderClient } from '../src/server/ai-provider.js';
import type { CandidateProfile } from '../src/shared/types.js';
import { AiProviderKind } from '../src/shared/types.js';

const profile: CandidateProfile = {
  name: 'Candidate', resumeFileName: 'resume.txt', resumeText: 'TypeScript engineer with four years of experience.',
  skills: ['TypeScript'], yearsExperience: 4, targetRoles: ['Frontend Engineer'], locations: ['Shanghai'],
  summary: 'Frontend engineer', language: 'en',
};

describe('AI provider output validation', () => {
  it('keeps sourced jobs and filters malformed records', async () => {
    const payload = {
      jobs: [
        {
          title: 'Frontend Engineer', company: 'Example', description: 'Build accessible product interfaces.',
          location: 'Shanghai', remote: true, sourceTitle: 'Example careers', sourceUrl: 'https://example.com/jobs/1',
          applyEmail: 'jobs@example.com', emailSourceUrl: 'https://example.com/jobs/1', score: 91, confidence: 0.9,
          matchedSkills: ['TypeScript'], missingSkills: [], reasons: ['Direct skill match'], subject: 'Application',
          body: 'Hello, I am applying for this frontend engineering opportunity.', usedResumeFacts: ['TypeScript'],
        },
        { title: 'Missing every required field' },
      ],
    };
    const request = async () => new Response(JSON.stringify({
      output_text: JSON.stringify(payload), output: [{ type: 'web_search_call' }],
    }), { status: 200 });
    const client = new AiProviderClient({ kind: AiProviderKind.OpenAI, apiKey: 'test-secret', model: 'test-model' }, request as typeof fetch);
    const result = await client.discoverJobs(profile, '', 10);
    expect(result.filtered).toBe(1);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({ eligible: true, applyEmail: 'jobs@example.com' });
  });

  it('rejects a private custom provider endpoint before making a request', async () => {
    let called = false;
    const request = async () => { called = true; return new Response('{}'); };
    const client = new AiProviderClient({ kind: AiProviderKind.Custom, apiKey: 'test-secret', model: 'test-model', baseUrl: 'https://127.0.0.1/v1' }, request as typeof fetch);
    await expect(client.probeWebSearch()).rejects.toThrow('私有网络');
    expect(called).toBe(false);
  });

  it('uses the Azure Responses endpoint and stable session header for the ByteDance preset', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const request = async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ output_text: '2026-09-07', output: [{ type: 'web_search_call' }] }), { status: 200 });
    };
    const client = new AiProviderClient({
      kind: AiProviderKind.ByteDanceAzure, apiKey: 'test-key', model: 'gpt-5.6-terra', sessionId: 'stable-session-id',
    }, request as typeof fetch);

    await client.probeWebSearch();

    expect(capturedUrl).toBe('https://search.bytedance.net/gpt/openapi/online/responses?api-version=2025-04-01-preview');
    expect(capturedInit?.headers).toMatchObject({ 'api-key': 'test-key', session_id: 'stable-session-id' });
    expect(JSON.parse(String(capturedInit?.body))).toMatchObject({
      model: 'gpt-5.6-terra', reasoning: { effort: 'xhigh', summary: 'auto' }, tools: [{ type: 'web_search' }],
    });
  });
});
