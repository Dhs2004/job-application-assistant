import type { JobRecord } from '../shared/types.js';

export const SAMPLE_JOBS: JobRecord[] = [
  {
    id: 'sample-frontend-aurora', title: '高级前端工程师', company: 'Aurora Labs',
    description: '负责数据产品体验，要求 3 年以上 React、TypeScript 开发经验，重视可访问性与工程质量。',
    location: '上海', remote: true, salaryMin: 350000, salaryMax: 520000, currency: 'CNY',
    skills: ['React', 'TypeScript', 'Vite', 'Accessibility', 'CSS'], requiredSkills: ['React', 'TypeScript'],
    applyEmail: 'jobs@example.com', url: 'https://example.com/jobs/frontend-aurora', source: '内置示例', active: true,
    importedAt: new Date().toISOString(),
  },
  {
    id: 'sample-ai-product-orbit', title: 'AI 产品工程师', company: 'Orbit Works',
    description: '构建 AI 工作流与评测平台，期望 2 年 TypeScript 或 Python 经验。',
    location: '北京', remote: false, salaryMin: 300000, salaryMax: 480000, currency: 'CNY',
    skills: ['TypeScript', 'Python', 'LLM', 'Evaluation', 'React'], requiredSkills: ['TypeScript', 'LLM'],
    applyEmail: 'talent@example.org', url: 'https://example.org/careers/ai-product', source: '内置示例', active: true,
    importedAt: new Date().toISOString(),
  },
  {
    id: 'sample-platform-nomail', title: '平台工程师', company: 'Northstar',
    description: '负责云原生平台建设，需要 5 年 Go、Kubernetes 经验。', location: '深圳', remote: false,
    skills: ['Go', 'Kubernetes', 'Cloud'], requiredSkills: ['Go', 'Kubernetes'],
    url: 'https://example.net/jobs/platform', source: '内置示例', active: true, importedAt: new Date().toISOString(),
  },
];
