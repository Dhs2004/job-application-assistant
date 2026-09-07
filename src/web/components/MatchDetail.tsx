import type { EmailDraft, JobMatch } from '../../shared/types';

interface Props {
  match?: JobMatch;
  draft?: EmailDraft;
  busy: boolean;
  onDraftChange: (draft: EmailDraft) => void;
  onSend: () => Promise<void>;
}

export function MatchDetail({ match, draft, busy, onDraftChange, onSend }: Props) {
  if (!match) return <aside className="detail-panel empty"><span>选择一个岗位</span><p>这里会展示匹配证据与邮件草稿。</p></aside>;
  return (
    <aside className="detail-panel">
      <div className="detail-kicker">MATCH REPORT / {match.score}</div>
      <h2>{match.job.title}</h2>
      <a href={match.job.url} target="_blank" rel="noreferrer">{match.job.company} ↗</a>
      <div className="breakdown">
        {Object.entries(match.breakdown).map(([name, score]) => (
          <div key={name}><span>{label(name)}</span><i><b style={{ width: `${score / max(name) * 100}%` }} /></i><strong>+{score}</strong></div>
        ))}
      </div>
      <section className="evidence">
        <h4>为什么匹配</h4>
        {match.reasons.map((reason) => <p key={reason}>✓ {reason}</p>)}
        {match.blockers.map((reason) => <p className="warning" key={reason}>! {reason}</p>)}
      </section>
      {draft && (
        <section className="draft">
          <div className="section-head"><h4>申请邮件</h4><span>发送前可编辑</span></div>
          <input value={draft.subject} onChange={(event) => onDraftChange({ ...draft, subject: event.target.value })} />
          <textarea value={draft.body} onChange={(event) => onDraftChange({ ...draft, body: event.target.value })} />
          <button className="primary wide" disabled={busy || !match.eligible} onClick={() => void onSend()}>{busy ? '发送中…' : '确认并投递'}</button>
        </section>
      )}
    </aside>
  );
}

const LABELS: Record<string, string> = { requiredSkills: '必备技能', relatedSkills: '相关能力', experience: '经验', location: '地点', roleAndSalary: '岗位偏好' };
const MAX: Record<string, number> = { requiredSkills: 45, relatedSkills: 20, experience: 15, location: 10, roleAndSalary: 10 };
function label(name: string) { return LABELS[name] ?? name; }
function max(name: string) { return MAX[name] ?? 1; }
