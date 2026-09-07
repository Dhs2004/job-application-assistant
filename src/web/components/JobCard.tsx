import type { JobMatch } from '../../shared/types';

interface Props { match: JobMatch; active: boolean; sent: boolean; onClick: () => void }

export function JobCard({ match, active, sent, onClick }: Props) {
  return (
    <button className={`job-card ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="score-orbit" style={{ '--score': `${match.score * 3.6}deg` } as React.CSSProperties}>
        <span>{match.score}</span>
      </div>
      <div className="job-card-copy">
        <div className="job-meta">{match.job.company} · {match.job.location}{match.job.remote ? ' / 可远程' : ''}</div>
        <h3>{match.job.title}</h3>
        <div className="tag-row">
          {match.matchedSkills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}
          {!match.eligible && <span className="blocked">暂不投递</span>}
          {sent && <span className="sent">已投递</span>}
        </div>
      </div>
      <span className="arrow">↗</span>
    </button>
  );
}
