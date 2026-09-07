import { describe, expect, it } from 'vitest';
import { createDedupeKey } from '../src/core/dedupe.js';
import { matchJob, rankJobs } from '../src/core/matcher.js';
import type { CandidateProfile, JobRecord } from '../src/shared/types.js';
import { RemotePreference } from '../src/shared/types.js';

const profile: CandidateProfile = {
  name: '测试用户', email: 'candidate@example.com', resumeFileName: 'resume.txt',
  resumeText: 'React TypeScript developer', skills: ['React', 'TypeScript', 'CSS'], yearsExperience: 4,
  targetRoles: ['前端工程师'], locations: ['上海'], remotePreference: RemotePreference.Any, language: 'zh',
};

const job: JobRecord = {
  id: 'job-1', title: '高级前端工程师', company: 'Example', description: '要求 3 年 React 和 TypeScript 经验',
  location: '上海', remote: true, skills: ['React', 'TypeScript', 'Vite'], requiredSkills: ['React', 'TypeScript'],
  applyEmail: 'jobs@example.com', url: 'https://example.com/job/1', source: 'test', active: true, importedAt: '2026-01-01T00:00:00.000Z',
};

describe('job matching', () => {
  it('scores matching evidence and keeps the result eligible', () => {
    const result = matchJob(profile, job);
    expect(result.eligible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.matchedSkills).toContain('react');
    expect(result.blockers).toEqual([]);
  });

  it('blocks a hard location mismatch', () => {
    const result = matchJob(profile, { ...job, location: '深圳', remote: false });
    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain('工作地点或远程方式不符合硬性偏好');
  });

  it('ranks deterministically and creates stable dedupe keys', () => {
    const weaker = { ...job, id: 'job-2', title: '后端工程师', skills: ['Go'], requiredSkills: ['Go'] };
    expect(rankJobs(profile, [weaker, job])[0]?.job.id).toBe('job-1');
    expect(createDedupeKey(job)).toBe(createDedupeKey({ ...job, company: ' example ' }));
  });
});
