import type { CandidateProfile, JobMatch, JobRecord, MatchBreakdown } from '../shared/types.js';
import { RemotePreference } from '../shared/types.js';
import { normalizeTerm, uniqueTerms } from './text.js';

function overlap(candidate: string[], expected: string[]): string[] {
  const normalizedCandidate = new Set(candidate.map(normalizeTerm));
  return uniqueTerms(expected).filter((term) => normalizedCandidate.has(term));
}

function ratio(found: number, total: number): number {
  return total === 0 ? 1 : found / total;
}

function includesLoose(haystack: string[], needle: string): boolean {
  const normalizedNeedle = normalizeTerm(needle);
  return haystack.some((value) => {
    const normalizedValue = normalizeTerm(value);
    return normalizedValue.includes(normalizedNeedle) || normalizedNeedle.includes(normalizedValue);
  });
}

/** Scores a normalized job and returns evidence for every scoring dimension. */
export function matchJob(profile: CandidateProfile, job: JobRecord): JobMatch {
  const matchedRequired = overlap(profile.skills, job.requiredSkills);
  const matchedRelated = overlap(profile.skills, job.skills);
  const missingSkills = uniqueTerms(job.requiredSkills).filter((skill) => !matchedRequired.includes(skill));
  const requiredRatio = ratio(matchedRequired.length, uniqueTerms(job.requiredSkills).length);
  const relatedRatio = ratio(matchedRelated.length, uniqueTerms(job.skills).length);

  const requestedYears = extractRequestedYears(job.description);
  const experienceRatio = requestedYears === 0 ? 1 : Math.min(profile.yearsExperience / requestedYears, 1);
  const locationMatch = profile.locations.length === 0 || includesLoose(profile.locations, job.location);
  const remoteMatch = profile.remotePreference === RemotePreference.Any
    || (profile.remotePreference === RemotePreference.Remote && job.remote)
    || (profile.remotePreference === RemotePreference.Onsite && !job.remote);
  const roleMatch = profile.targetRoles.length === 0 || includesLoose(profile.targetRoles, job.title);
  const salaryMatch = profile.minimumSalary === undefined
    || job.salaryMin === undefined
    || job.salaryMin >= profile.minimumSalary;

  const breakdown: MatchBreakdown = {
    requiredSkills: Math.round(requiredRatio * 45),
    relatedSkills: Math.round(relatedRatio * 20),
    experience: Math.round(experienceRatio * 15),
    location: locationMatch && remoteMatch ? 10 : 0,
    roleAndSalary: Math.round((Number(roleMatch) + Number(salaryMatch)) * 5),
  };
  const blockers: string[] = [];
  if (!job.active) blockers.push('岗位已停止招聘');
  if (!job.applyEmail) blockers.push('岗位没有公开申请邮箱');
  if (!locationMatch || !remoteMatch) blockers.push('工作地点或远程方式不符合硬性偏好');
  if (!salaryMatch) blockers.push('最低薪资低于你的要求');
  if (requiredRatio < 0.5 && job.requiredSkills.length > 1) blockers.push('必备技能覆盖不足 50%');

  const reasons = [
    matchedRequired.length ? `命中必备技能：${matchedRequired.join('、')}` : '岗位未列出已命中的必备技能',
    matchedRelated.length ? `相关技能：${matchedRelated.join('、')}` : '相关技能匹配较少',
    requestedYears ? `经验要求约 ${requestedYears} 年，你填写了 ${profile.yearsExperience} 年` : '岗位未给出明确年限要求',
    locationMatch && remoteMatch ? '地点与工作方式符合偏好' : '地点或工作方式不符合偏好',
  ];

  return {
    job,
    score: Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0)),
    eligible: blockers.length === 0,
    matchedSkills: uniqueTerms([...matchedRequired, ...matchedRelated]),
    missingSkills,
    reasons,
    blockers,
    breakdown,
  };
}

export function rankJobs(profile: CandidateProfile, jobs: JobRecord[]): JobMatch[] {
  return jobs.map((job) => matchJob(profile, job)).sort((a, b) => b.score - a.score || a.job.title.localeCompare(b.job.title));
}

function extractRequestedYears(text: string): number {
  const match = text.match(/(?:至少|minimum|at least)?\s*(\d{1,2})\+?\s*(?:年|years?)/i);
  return match ? Number(match[1]) : 0;
}
