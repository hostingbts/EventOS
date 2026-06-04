import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTeamOverview } from '../api/client';
import type { TeamOverview } from '../types';
import './TeamPage.css';

export function TeamPage() {
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamOverview()
      .then(setTeam)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="team__msg">Loading team…</p>;
  if (!team) return <p className="team__msg">No team data.</p>;

  return (
    <div className="team">
      <header>
        <h1>Team</h1>
        <p>Who is working on what across all events.</p>
      </header>

      <div className="team__stats">
        <div className="team__stat">
          <strong>{team.totalTasks}</strong>
          <span>Total tasks</span>
        </div>
        <div className="team__stat">
          <strong>{team.openTasks}</strong>
          <span>Open tasks</span>
        </div>
        <div className="team__stat">
          <strong>{team.members.length}</strong>
          <span>Contributors</span>
        </div>
      </div>

      <div className="team__members">
        {team.members.map((m) => (
          <article key={m.email || m.name} className="team__card">
            <h2>{m.name}</h2>
            {m.email && <p className="team__email">{m.email}</p>}
            <ul>
              {m.tasks.map((t) => (
                <li key={t.taskId}>
                  <Link to={`/event/${encodeURIComponent(t.eventCode)}`}>
                    <strong>{t.eventCode}</strong> — {t.title}
                  </Link>
                  <span className={`team__status team__status--${t.status}`}>{t.status.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {team.members.length === 0 && (
          <p className="team__msg">Open an event workspace to create tasks and assign teammates.</p>
        )}
      </div>
    </div>
  );
}
