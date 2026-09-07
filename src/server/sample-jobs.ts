import type { CandidateProfile, DiscoveredJob } from '../shared/types.js';

/** Creates clearly labelled demo records without implying that they are live openings. */
export function createSampleJobs(profile: CandidateProfile): DiscoveredJob[] {
  const searchedAt = new Date().toISOString();
  return [
    {
      id: 'demo-frontend-aurora', title: profile.targetRoles[0] ?? '高级前端工程师', company: 'Aurora Labs（演示）',
      description: '演示岗位：负责数据产品体验，重视 TypeScript、可访问性与工程质量。',
      location: profile.locations[0] ?? '上海', remote: true, sourceTitle: '内置演示数据（非真实招聘）',
      sourceUrl: 'https://example.com/jobs/frontend-demo', applyEmail: 'jobs@example.com',
      emailSourceUrl: 'https://example.com/jobs/frontend-demo', searchedAt, score: 88, confidence: 0.98,
      matchedSkills: profile.skills.slice(0, 3), missingSkills: ['Accessibility'],
      reasons: ['岗位方向与候选人档案接近', '支持远程协作'], blockers: [], eligible: true,
      draft: {
        to: 'jobs@example.com', subject: `Application for ${profile.targetRoles[0] ?? 'Frontend Engineer'} — ${profile.name}`,
        body: `Hello Aurora Labs hiring team,\n\nI am applying for this demo role. My resume includes ${profile.skills.slice(0, 3).join(', ') || 'relevant product engineering experience'}.\n\nBest regards,\n${profile.name}`,
        usedResumeFacts: profile.skills.slice(0, 3),
      },
    },
    {
      id: 'demo-no-email', title: '平台工程师', company: 'Northstar（演示）',
      description: '演示岗位：构建云原生开发平台。', location: '深圳', remote: false,
      sourceTitle: '内置演示数据（非真实招聘）', sourceUrl: 'https://example.net/jobs/platform-demo',
      searchedAt, score: 52, confidence: 0.9, matchedSkills: [], missingSkills: ['Go', 'Kubernetes'],
      reasons: ['用于演示无公开邮箱时的拦截状态'], blockers: ['未找到可验证的公开招聘邮箱'], eligible: false,
    },
  ];
}
