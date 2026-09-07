import { useEffect, useMemo, useState } from 'react';
import type { AutomationSettings, DashboardData, EmailDraft } from '../shared/types';
import { api } from './api';
import { JobCard } from './components/JobCard';
import { MatchDetail } from './components/MatchDetail';
import { ProfileSetup } from './components/ProfileSetup';

export default function App() {
  const [data, setData] = useState<DashboardData>();
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<EmailDraft>();
  const [feedUrl, setFeedUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showResume, setShowResume] = useState(false);

  useEffect(() => { void run('加载数据', async () => setData(await api.dashboard())); }, []);
  const selected = useMemo(() => data?.matches.find((item) => item.job.id === selectedId), [data, selectedId]);
  const sentIds = useMemo(() => new Set(data?.deliveries.filter((item) => item.status === 'sent').map((item) => item.jobId)), [data]);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label); setError(''); setNotice('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败'); }
    finally { setBusy(''); }
  }

  async function chooseJob(jobId: string) {
    setSelectedId(jobId); setDraft(undefined);
    await run('生成邮件', async () => setDraft(await api.draft(jobId)));
  }

  if (!data) return <div className="loading-screen"><span>投递舱</span><i /></div>;
  if (!data.profile) {
    return <><ProfileSetup busy={Boolean(busy)} onSubmit={(payload) => run('读取简历', async () => setData(await api.uploadProfile(payload)))} /><Toast error={error} /></>;
  }

  const eligible = data.matches.filter((item) => item.eligible && item.score >= data.settings.threshold).length;
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span>投</span><b>投递舱</b><small>JOB APPLICATION ASSISTANT</small></div>
        <div className="top-actions">
          <button className="text-button" onClick={() => setShowHistory(!showHistory)}>{showHistory ? '返回岗位' : `投递记录 ${data.deliveries.length}`}</button>
          <button className="avatar" onClick={() => setShowResume(true)} title="查看简历">{data.profile.name.slice(0, 1)}</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="control-rail">
          <div className="rail-section">
            <span className="eyebrow">AUTOPILOT</span>
            <div className="switch-row"><div><b>自动投递</b><small>{data.settings.enabled ? '正在守候新岗位' : '当前仅生成草稿'}</small></div><button className={`toggle ${data.settings.enabled ? 'on' : ''}`} onClick={() => void saveSettings(data, { enabled: !data.settings.enabled }, setData, run)}><i /></button></div>
            <label className="range-label"><span>最低匹配分 <b>{data.settings.threshold}</b></span><input type="range" min="50" max="95" value={data.settings.threshold} onChange={(event) => void saveSettings(data, { threshold: Number(event.target.value), enabled: false }, setData, run)} /></label>
            <label>每日上限<select value={data.settings.dailyLimit} onChange={(event) => void saveSettings(data, { dailyLimit: Number(event.target.value), enabled: false }, setData, run)}>{[1, 3, 5, 10, 20, 30].map((count) => <option key={count}>{count}</option>)}</select></label>
            <label className="check-row"><input type="checkbox" checked={data.settings.templateConfirmed} onChange={(event) => void saveSettings(data, { templateConfirmed: event.target.checked, enabled: false }, setData, run)} /><span>我已预览并确认邮件模板</span></label>
          </div>

          <div className="rail-section connection">
            <span className="eyebrow">MAIL CONNECTION</span>
            <div className={`status-dot ${data.settings.smtpTested ? 'ready' : ''}`}><i />{data.settings.smtpTested ? 'SMTP 已验证' : data.smtp.configured ? '等待发送测试' : '需要配置 .env'}</div>
            {data.smtp.from && <small>{data.smtp.from}</small>}
            <button className="outline wide" disabled={!data.smtp.configured || Boolean(busy)} onClick={() => void run('测试邮件', async () => { setData(await api.testMail(data.profile!.email)); setNotice('测试邮件已发送到你的邮箱'); })}>发送测试邮件</button>
          </div>

          <div className="rail-section source">
            <span className="eyebrow">JOB SOURCE</span>
            <button className="outline wide" onClick={() => void run('加载示例', async () => setData(await api.loadSamples()))}>载入示例岗位</button>
            <div className="feed-input"><input value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} placeholder="HTTPS JSON Feed" /><button disabled={!feedUrl} onClick={() => void run('导入岗位', async () => { const result = await api.importFeed(feedUrl); setData(result.dashboard); setNotice(`成功导入 ${result.imported} 个岗位`); })}>→</button></div>
          </div>

          <div className="rail-footer"><a href="/api/export">导出记录</a><button onClick={() => void clearAll()}>清除本地数据</button></div>
        </aside>

        {showHistory ? <History data={data} /> : (
          <main className="job-stage">
            <section className="stage-head"><div><span className="eyebrow">TODAY'S SHORTLIST</span><h1>{data.matches.length ? `${eligible} 个值得出手的岗位` : '等待第一批岗位'}</h1></div><div className="metric"><b>{data.matches.length}</b><span>已分析</span></div><div className="metric accent"><b>{data.deliveries.filter((item) => item.status === 'sent').length}</b><span>已投递</span></div></section>
            <section className="job-list">
              {data.matches.length === 0 ? <EmptyJobs onLoad={() => void run('加载示例', async () => setData(await api.loadSamples()))} /> : data.matches.map((match) => <JobCard key={match.job.id} match={match} active={selectedId === match.job.id} sent={sentIds.has(match.job.id)} onClick={() => void chooseJob(match.job.id)} />)}
            </section>
          </main>
        )}
        {!showHistory && <MatchDetail match={selected} draft={draft} busy={busy === '发送邮件'} onDraftChange={setDraft} onSend={() => run('发送邮件', async () => { if (!selected || !draft) return; await api.send(selected.job.id, draft); setData(await api.dashboard()); setNotice('申请邮件已交给 SMTP'); })} />}
      </div>
      {showResume && <ResumeEditor data={data} busy={Boolean(busy)} onClose={() => setShowResume(false)} onSave={(payload) => run('保存简历', async () => { setData(await api.updateProfile(payload)); setShowResume(false); })} />}
      <Toast error={error} notice={notice} />
    </div>
  );

  async function clearAll() {
    if (!window.confirm('确定删除本机保存的简历、岗位和投递记录吗？此操作不可撤销。')) return;
    await run('清除数据', async () => { await api.clear(); setData(await api.dashboard()); });
  }
}

async function saveSettings(data: DashboardData, patch: Partial<AutomationSettings>, setData: (data: DashboardData) => void, run: (label: string, action: () => Promise<void>) => Promise<void>) {
  const next = { ...data.settings, ...patch };
  await run('保存设置', async () => setData(await api.saveAutomation({ enabled: next.enabled, threshold: next.threshold, dailyLimit: next.dailyLimit, templateConfirmed: next.templateConfirmed })));
}

function EmptyJobs({ onLoad }: { onLoad: () => void }) { return <div className="empty-jobs"><span>∅</span><h2>还没有岗位进入雷达</h2><p>先载入安全的示例数据体验匹配，或在左侧添加符合格式的 HTTPS JSON Feed。</p><button className="primary" onClick={onLoad}>载入示例岗位</button></div>; }
function Toast({ error, notice }: { error?: string; notice?: string }) { return error || notice ? <div className={`toast ${error ? 'error' : ''}`}>{error || notice}</div> : null; }
function History({ data }: { data: DashboardData }) { return <main className="job-stage history"><div className="stage-head"><div><span className="eyebrow">APPLICATION LOG</span><h1>每一次投递，都有迹可循。</h1></div></div>{data.deliveries.length === 0 ? <p className="history-empty">尚无投递记录。</p> : <table><thead><tr><th>时间</th><th>岗位</th><th>收件人</th><th>状态</th></tr></thead><tbody>{data.deliveries.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{data.matches.find((match) => match.job.id === item.jobId)?.job.title ?? item.jobId}</td><td>{item.recipient.replace(/^(.{2}).*(@.*)$/, '$1***$2')}</td><td><span className={`status ${item.status}`}>{item.status}</span></td></tr>)}</tbody></table>}</main>; }

function ResumeEditor({ data, busy, onClose, onSave }: { data: DashboardData; busy: boolean; onClose: () => void; onSave: (payload: unknown) => Promise<void> }) {
  const profile = data.profile!;
  const [resumeText, setResumeText] = useState(profile.resumeText);
  const [skills, setSkills] = useState(profile.skills.join(', '));
  return <div className="modal-backdrop"><section className="resume-modal"><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow">RESUME REVIEW</span><h2>校正解析结果</h2><label>技能<input value={skills} onChange={(event) => setSkills(event.target.value)} /></label><label>简历文本<textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} /></label><button className="primary" disabled={busy} onClick={() => void onSave({ resumeText, skills: skills.split(/[,，、]/).map((v) => v.trim()).filter(Boolean), yearsExperience: profile.yearsExperience, targetRoles: profile.targetRoles, locations: profile.locations, remotePreference: profile.remotePreference, minimumSalary: profile.minimumSalary, language: profile.language })}>保存校正</button></section></div>;
}
