import { useState } from 'react';
import type { Comment } from '../../types';
import { addComment } from '../../api/client';
import { useUser } from '../../context/UserContext';
import './CommentThread.css';

interface Props {
  comments: Comment[];
  eventCode: string;
  taskId?: string;
  onAdded: (comment: Comment) => void;
}

export function CommentThread({ comments, eventCode, taskId, onAdded }: Props) {
  const { user } = useUser();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !user) return;
    setSending(true);
    try {
      const c = await addComment({
        eventCode,
        taskId,
        authorEmail: user.email,
        authorName: user.name,
        body: body.trim(),
      });
      onAdded(c);
      setBody('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="comments">
      <ul className="comments__list">
        {comments.map((c) => (
          <li key={c.commentId}>
            <div className="comments__meta">
              <strong>{c.authorName || c.authorEmail}</strong>
              <time>{formatTime(c.createdAt)}</time>
            </div>
            <p>{c.body}</p>
          </li>
        ))}
        {comments.length === 0 && <li className="comments__empty">No comments yet — start the conversation.</li>}
      </ul>
      {user ? (
        <form className="comments__form" onSubmit={handleSubmit}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message to your team…"
            rows={2}
            disabled={sending}
          />
          <button type="submit" disabled={sending || !body.trim()}>
            Post
          </button>
        </form>
      ) : (
        <p className="comments__signin">Sign in to comment.</p>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
