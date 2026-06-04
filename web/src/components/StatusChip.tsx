import './StatusChip.css';

type ChipKind = 'lem' | 'av' | 'interpreters' | 'generic';

interface Props {
  value: string;
  kind?: ChipKind;
}

function normalize(v: string) {
  return v.trim().toLowerCase();
}

function chipClass(value: string, kind: ChipKind): string {
  const v = normalize(value);
  if (!v) return 'chip chip--empty';

  if (kind === 'lem') {
    if (v === 'closed') return 'chip chip--success';
    if (v.includes('connectmice') || v.includes('full')) return 'chip chip--brand';
    return 'chip chip--warn';
  }

  if (kind === 'av') {
    if (v === 'yes') return 'chip chip--success';
    if (v === 'no') return 'chip chip--danger';
    return 'chip chip--muted';
  }

  if (kind === 'interpreters') {
    if (v === 'psa') return 'chip chip--brand';
    if (v.includes('connectmice')) return 'chip chip--success';
    if (v === 'no') return 'chip chip--muted';
  }

  return 'chip chip--muted';
}

export function StatusChip({ value, kind = 'generic' }: Props) {
  const display = value?.trim() || '—';
  return <span className={chipClass(display, kind)}>{display}</span>;
}
