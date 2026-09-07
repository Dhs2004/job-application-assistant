import type { CandidateProfile, EmailDraft, JobMatch } from '../shared/types.js';

/** Builds an editable draft using only facts present in the candidate profile. */
export function createEmailDraft(profile: CandidateProfile, match: JobMatch): EmailDraft {
  const skills = match.matchedSkills.slice(0, 4).join('、') || profile.skills.slice(0, 4).join('、');
  if (profile.language === 'en') {
    return {
      to: match.job.applyEmail ?? '',
      subject: `Application for ${match.job.title} — ${profile.name}`,
      body: `Hello ${match.job.company} Hiring Team,\n\nI am applying for the ${match.job.title} position. My experience with ${skills || 'the skills described in my resume'} aligns with the role, and I have ${profile.yearsExperience} years of relevant experience.\n\nMy resume is attached for your review. I would welcome the opportunity to discuss how I can contribute to ${match.job.company}.\n\nBest regards,\n${profile.name}\n${profile.email}`,
    };
  }
  return {
    to: match.job.applyEmail ?? '',
    subject: `应聘 ${match.job.title}｜${profile.name}`,
    body: `${match.job.company} 招聘团队您好：\n\n我希望应聘贵公司的「${match.job.title}」岗位。我的相关经验包括 ${skills || '简历中列出的相关能力'}，并拥有 ${profile.yearsExperience} 年相关工作经验。\n\n附件是我的简历，期待有机会进一步交流我能为团队带来的价值。\n\n谢谢！\n${profile.name}\n${profile.email}`,
  };
}
