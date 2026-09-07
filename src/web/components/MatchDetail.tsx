import type { DiscoveredJob, EmailDraft } from '../../shared/types';

interface Props {
  job?: DiscoveredJob;
  draft?: EmailDraft;
  busy: boolean;
  smtpConnected: boolean;
  sent: boolean;
  onDraftChange: (draft: EmailDraft) => void;
  onSend: () => Promise<void>;
}

export function MatchDetail({ job, draft, busy, smtpConnected, sent, onDraftChange, onSend }: Props) {
  if (!job) return <aside className="detail-panel empty"><span>选择一个岗位</span><p>这里会展示来源、匹配证据与 AI 草稿。</p></aside>;
  return (
    <aside className="detail-panel">
      <div className="detail-kicker">AI MATCH / {job.score} · 置信度 {Math.round(job.confidence * 100)}%</div>
      <h2>{job.title}</h2>
      <a href={job.sourceUrl} target="_blank" rel="noreferrer">{job.sourceTitle} ↗</a>
      <section className="evidence">
        <h4>匹配证据</h4>
        {job.reasons.map((reason) => <p key={reason}>✓ {reason}</p>)}
        {job.missingSkills.map((skill) => <p key={skill}>○ 待补充：{skill}</p>)}
        {job.blockers.map((reason) => <p className="warning" key={reason}>! {reason}</p>)}
      </section>
      <section className="source-proof">
        <span>搜索时间 {new Date(job.searchedAt).toLocaleString()}</span>
        {job.emailSourceUrl ? <a href={job.emailSourceUrl} target="_blank" rel="noreferrer">公开招聘邮箱来源 ↗</a> : <span>未找到可验证邮箱，请从岗位页申请</span>}
      </section>
      {draft && (
        <section className="draft">
          <div className="section-head"><h4>申请邮件</h4><span>发送前可编辑</span></div>
          <input aria-label="邮件主题" value={draft.subject} onChange={(event) => onDraftChange({ ...draft, subject: event.target.value })} />
          <textarea aria-label="邮件正文" value={draft.body} onChange={(event) => onDraftChange({ ...draft, body: event.target.value })} />
          <small>依据的简历事实：{draft.usedResumeFacts.join('、') || '未标注'}</small>
          <button className="primary wide" disabled={busy || !job.eligible || !smtpConnected || sent} onClick={() => void onSend()}>
            {sendButtonLabel(sent, busy, smtpConnected)}
          </button>
        </section>
      )}
    </aside>
  );
}

function sendButtonLabel(sent: boolean, busy: boolean, smtpConnected: boolean): string {
  if (sent) return '已投递';
  if (busy) return '确认中…';
  if (!smtpConnected) return '先连接发件邮箱';
  return '确认并投递这一封';
}
