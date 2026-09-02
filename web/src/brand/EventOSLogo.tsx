import { useEffect, useState } from 'react';
import './eventos-logo.css';

interface EventOSLogoProps {
  size?: number;
  wordmark?: boolean;
  loop?: boolean;
  className?: string;
}

export function EventOSLogo({ size = 20, wordmark = true, loop = false, className }: EventOSLogoProps) {
  const cls = [
    'eventos-logo',
    wordmark ? '' : 'eventos-logo--icon',
    loop ? 'eventos-logo--loop' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={{ fontSize: size }} aria-label="EventOS" role="img">
      <div className="eventos-logo__tile">
        <div className="eventos-logo__bar" />
        <div className="eventos-logo__bar eventos-logo__bar--live" />
        <div className="eventos-logo__bar" />
      </div>
      {wordmark && <div className="eventos-logo__word">Event<em>OS</em></div>}
    </div>
  );
}

interface EventOSSplashProps {
  onDone?: () => void;
  minMs?: number;
}

export function EventOSSplash({ onDone, minMs = 3800 }: EventOSSplashProps) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('eos-splash')) {
      setGone(true);
      onDone?.();
      return;
    }
    const t = setTimeout(() => {
      sessionStorage.setItem('eos-splash', '1');
      setGone(true);
      onDone?.();
    }, minMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minMs]);

  if (gone) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0b1220',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <EventOSLogo size={18} />
    </div>
  );
}
