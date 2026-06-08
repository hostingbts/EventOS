import { useEffect, useState } from 'react';
import {
  DATE_INPUT_PLACEHOLDER,
  formatIsoDate,
  parseToIsoDate,
} from '../utils/dateFormat';

interface DateInputProps {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function DateInput({
  value,
  onChange,
  min,
  className,
  disabled,
  id,
}: DateInputProps) {
  const [text, setText] = useState(() => formatIsoDate(value));

  useEffect(() => {
    setText(formatIsoDate(value));
  }, [value]);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange('');
      setText('');
      return;
    }
    const iso = parseToIsoDate(trimmed);
    if (!iso) {
      setText(formatIsoDate(value));
      return;
    }
    if (min && iso < min) {
      setText(formatIsoDate(value));
      return;
    }
    onChange(iso);
    setText(formatIsoDate(iso));
  }

  return (
    <input
      id={id}
      type="text"
      className={className}
      value={text}
      placeholder={DATE_INPUT_PLACEHOLDER}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="off"
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(text);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
