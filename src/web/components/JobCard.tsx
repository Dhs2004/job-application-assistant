import type { DiscoveredJob } from '../../shared/types';

interface Props { job: DiscoveredJob; active: boolean; sent: boolean; onClick: () => void }

export function JobCard({ job, active, sent, onClick }: Props) {
  return (
    <button className={`job-card ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="score-orbit" style={{ '--score': `${job.score * 3.6}deg` } as React.CSSProperties}><span>{job.score}</span></div>
      <div className="job-card-copy">
        <div className="job-meta">{job.company} · {job.location}{job.remote ? ' / 可远程' : ''}</div>
        <h3>{job.title}</h3>
        <div className="tag-row">
          {job.matchedSkills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}
          {!job.eligible && <span className="blocked">需要核验</span>}
          {sent && <span className="sent">已投递</span>}
        </div>
      </div>
      <span className="arrow">↗</span>
    </button>
  );
}
