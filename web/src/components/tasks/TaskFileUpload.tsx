import { useRef } from 'react';
import './TaskFileUpload.css';

interface Props {
  onFilesSelected: (files: FileList | null) => void;
  disabled?: boolean;
}

export function TaskFileUpload({ onFilesSelected, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`file-drop ${disabled ? 'file-drop--disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) e.currentTarget.classList.add('file-drop--over');
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove('file-drop--over')}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('file-drop--over');
        if (!disabled) onFilesSelected(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        disabled={disabled}
        onChange={(e) => onFilesSelected(e.target.files)}
      />
      <p>
        <strong>Drop files here</strong> or click to browse
      </p>
      <small>PDF, Word, Excel, images — max 10 MB each</small>
    </div>
  );
}
