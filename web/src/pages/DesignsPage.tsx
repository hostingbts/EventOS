import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchEvents } from '../api/client';
import { getAllEventDesigns, type EventDesignSetup } from '../utils/designStore';
import type { Event } from '../types';
import './DesignsPage.css';

const DESIGN_TYPES = [
  { key: 'badge',    label: 'Name Badge',     icon: '🪪', desc: 'Personalised with name, title & organisation. Fits multiple per A4 / A3 sheet.' },
  { key: 'tent',     label: 'Table Tent',      icon: '🔖', desc: 'A4 landscape, fold-in-half — name visible from both sides.' },
  { key: 'cert',     label: 'Certificate',     icon: '📜', desc: 'A4 landscape, signed certificate of participation.' },
  { key: 'banner',   label: 'Roll-up Banner',  icon: '🖼️', desc: '85 × 200 cm or 80 × 200 cm — event branding only.' },
  { key: 'screen',   label: 'Screen Banner',   icon: '📺', desc: '16:9 presentation slide — logo, title, city, dates.' },
];

export function DesignsPage() {
  const [events, setEvents]   = useState<Event[]>([]);
  const [designs, setDesigns] = useState<Array<{ setup: EventDesignSetup; attendeeCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState('');

  useEffect(() => {
    fetchEvents()
      .then((res) => {
        setEvents(res.events);
        if (res.events.length) setSelectedCode(res.events[0].code);
      })
      .finally(() => setLoading(false));
    setDesigns(getAllEventDesigns());
  }, []);

  const saved = designs.filter((d) => d.setup.eventCode);

  return (
    <div className="designs-page">
      <header className="designs-page__header">
        <div>
          <h1>Designs</h1>
          <p>Create print-ready design assets for your events — name badges, table tents, certificates, and banners.</p>
        </div>
      </header>

      {/* Quick-start picker */}
      <section className="designs-page__start">
        <h2>Open design workspace</h2>
        <div className="designs-page__picker">
          <select
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            disabled={loading || events.length === 0}
          >
            {loading && <option>Loading events…</option>}
            {events.map((ev) => (
              <option key={ev.code} value={ev.code}>
                {ev.code} — {ev.location} ({ev.dates})
              </option>
            ))}
          </select>
          <Link
            to={selectedCode ? `/designs/${selectedCode}` : '#'}
            className={`designs-btn designs-btn--primary${!selectedCode ? ' disabled' : ''}`}
          >
            Open workspace →
          </Link>
        </div>
      </section>

      {/* Design type overview */}
      <section className="designs-page__types">
        <h2>Supported design types</h2>
        <div className="designs-types-grid">
          {DESIGN_TYPES.map((t) => (
            <div key={t.key} className="designs-type-card">
              <span className="designs-type-card__icon">{t.icon}</span>
              <strong>{t.label}</strong>
              <p>{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Saved designs */}
      {saved.length > 0 && (
        <section className="designs-page__saved">
          <h2>Events with saved designs</h2>
          <div className="designs-saved-list">
            {saved.map(({ setup, attendeeCount }) => (
              <div key={setup.eventCode} className="designs-saved-card">
                <div className="designs-saved-card__palette">
                  <span style={{ background: setup.primaryColor }} />
                  <span style={{ background: setup.accentColor }} />
                </div>
                <div className="designs-saved-card__info">
                  <strong>{setup.eventCode}</strong>
                  <span>{setup.title}</span>
                  <small>
                    {setup.cityCountry} · {setup.dateStr}
                    {attendeeCount > 0 && <> · <b>{attendeeCount}</b> attendee{attendeeCount !== 1 ? 's' : ''}</>}
                  </small>
                </div>
                <div className="designs-saved-card__actions">
                  <Link to={`/designs/${setup.eventCode}`} className="designs-btn designs-btn--sm designs-btn--primary">
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
