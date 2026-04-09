import React, { useState } from "react";

function formatDate(value) {
  if (!value) {
    return "Just now";
  }

  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Just now";
  }
}

function formatRole(role) {
  const normalized = (role || "note").toLowerCase();
  if (normalized === "assistant") return "Assistant";
  if (normalized === "system") return "System";
  return "You";
}

function ChatHistoryPanel({
  threads,
  messages,
  activeThreadId,
  threadTitle,
  threadMessage,
  newMessage,
  loading,
  error,
  onThreadTitleChange,
  onThreadMessageChange,
  onCreateThread,
  onSelectThread,
  onNewMessageChange,
  onSendMessage,
  onDeleteThread,
}) {
  const [threadSearch, setThreadSearch] = useState("");
  const activeThread = threads.find((item) => item.id === activeThreadId) || threads[0] || null;
  const normalizedSearch = threadSearch.trim().toLowerCase();
  const visibleThreads = normalizedSearch
    ? threads.filter((item) => {
        const haystack = `${item.title} ${item.lastMessagePreview || ""}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : threads;
  const totalMessages = threads.reduce((sum, item) => sum + (item.messageCount || 0), 0);
  const assistantMessages = threads.reduce((sum, item) => sum + (item.assistantMessageCount || 0), 0);
  const latestActivity = activeThread?.lastMessageAt || threads[0]?.lastMessageAt || null;

  return (
    <div className="workspace-premium-shell">
      <section className="workspace-command-hero">
        <article className="workspace-hub-card workspace-command-story workspace-chat-premium-hero">
          <div className="workspace-command-topline">
            <div>
              <span className="workspace-command-kicker">Conversation Archive</span>
              <h3 className="workspace-command-title">Premium chat history built for continuity, handoff, and clean recall.</h3>
              <p className="workspace-command-lede">
                Save strategic prompts, assistant outputs, and reference notes in a structured workspace that feels closer to an executive operations console than a simple message log.
              </p>
            </div>
            <div className="workspace-chat-hero-pill">
              <span>Live workspace</span>
              <strong>{threads.length}</strong>
            </div>
          </div>

          <div className="workspace-command-badge-row">
            <article className="workspace-command-badge">
              <span>Saved threads</span>
              <strong>{threads.length}</strong>
              <p>Persistent conversation lanes ready for follow-up work.</p>
            </article>
            <article className="workspace-command-badge">
              <span>Total messages</span>
              <strong>{totalMessages}</strong>
              <p>Notes, prompts, and assistant responses held in history.</p>
            </article>
            <article className="workspace-command-badge">
              <span>Assistant outputs</span>
              <strong>{assistantMessages}</strong>
              <p>Reusable responses captured for delivery and review.</p>
            </article>
          </div>
        </article>

        <aside className="workspace-command-sidebar">
          <section className="workspace-hub-card workspace-spotlight-panel">
            <div className="workspace-spotlight-head">
              <span className="workspace-spotlight-tag">Focus thread</span>
              <span className="workspace-spotlight-time">{formatDate(latestActivity)}</span>
            </div>
            <strong>{activeThread?.title || "Select a thread"}</strong>
            <p>{activeThread?.lastMessagePreview || "Open a thread to review saved context and continue from where you left off."}</p>
            <div className="workspace-focus-meta">
              <span>{activeThread?.messageCount || 0} messages</span>
              <span>{formatRole(activeThread?.lastMessageRole)}</span>
            </div>
          </section>
        </aside>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="workspace-command-main">
        <article className="workspace-hub-card workspace-chat-compose-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">New thread</span>
              <h4>Capture a new conversation lane</h4>
            </div>
            <span className="workspace-section-summary">Structured for premium workspace recall</span>
          </div>
          <div className="workspace-form-stack">
            <input
              type="text"
              className="workspace-input"
              placeholder="Q3 launch brief, client FAQ pack, escalation notes..."
              value={threadTitle}
              onChange={(event) => onThreadTitleChange(event.target.value)}
            />
            <textarea
              className="workspace-textarea"
              placeholder="Add an opening brief, saved answer, or internal note."
              value={threadMessage}
              onChange={(event) => onThreadMessageChange(event.target.value)}
              rows={5}
            />
            <button type="button" className="hero-button hero-button-primary" onClick={onCreateThread} disabled={loading}>
              {loading ? "Saving..." : "Create Premium Thread"}
            </button>
          </div>
        </article>

        <article className="workspace-hub-card workspace-chat-summary-card">
          <span className="workspace-hub-eyebrow">Control tower</span>
          <div className="workspace-signal-grid">
            <article className="workspace-signal-tile is-priority workspace-hub-card">
              <span className="workspace-hub-eyebrow">Most active</span>
              <strong>{threads[0]?.title || "No history yet"}</strong>
              <p>{threads[0]?.messageCount || 0} messages currently lead your workspace archive.</p>
            </article>
            <article className="workspace-signal-tile workspace-hub-card">
              <span className="workspace-hub-eyebrow">Latest activity</span>
              <strong>{formatDate(latestActivity)}</strong>
              <p>Recent workspace note or prompt saved into chat history.</p>
            </article>
          </div>
        </article>
      </section>

      <section className="workspace-hub-card workspace-chat-library-card">
        <div className="workspace-section-heading">
          <div>
            <span className="workspace-hub-eyebrow">Thread library</span>
            <h4>Search, select, and revisit saved work</h4>
          </div>
          <span className="workspace-section-summary">{visibleThreads.length} visible</span>
        </div>
        <label className="workspace-search-shell">
          <span>Thread search</span>
          <input
            type="text"
            className="workspace-input workspace-command-search"
            placeholder="Find by title or preview"
            value={threadSearch}
            onChange={(event) => setThreadSearch(event.target.value)}
          />
        </label>

        <div className="workspace-hub-list workspace-chat-thread-grid">
          {visibleThreads.length > 0 ? (
            visibleThreads.map((item) => (
              <article key={item.id} className={`workspace-hub-list-item workspace-chat-thread-tile ${activeThread?.id === item.id ? "is-active" : ""}`}>
                <button type="button" className="workspace-card-button" onClick={() => onSelectThread(item.id)}>
                  <div className="workspace-chat-thread-head">
                    <strong>{item.title}</strong>
                    <span className={`workspace-chat-role-tag is-${item.lastMessageRole || "user"}`}>
                      {formatRole(item.lastMessageRole)}
                    </span>
                  </div>
                  <p>{item.lastMessagePreview || "No preview yet."}</p>
                  <div className="workspace-hub-inline-meta">
                    <span>{item.messageCount} messages</span>
                    <span>{formatDate(item.lastMessageAt || item.updatedAt || item.createdAt)}</span>
                  </div>
                </button>
              </article>
            ))
          ) : (
            <p className="status-item status-info">No saved threads match this search yet.</p>
          )}
        </div>
      </section>

      <section className="workspace-hub-card workspace-chat-transcript-card">
        <div className="workspace-section-heading">
          <div>
            <span className="workspace-hub-eyebrow">Transcript</span>
            <h4>{activeThread?.title || "Thread messages"}</h4>
          </div>
          {activeThread ? (
            <button type="button" className="admin-table-action-button" onClick={() => onDeleteThread(activeThread.id)} disabled={loading}>
              {loading ? "Working..." : "Delete Thread"}
            </button>
          ) : null}
        </div>

        <div className="workspace-chat-message-stream">
          {messages.length > 0 ? (
            messages.map((item) => (
              <article key={item.id} className={`workspace-chat-bubble is-${item.role}`}>
                <div className="workspace-chat-bubble-head">
                  <strong>{formatRole(item.role)}</strong>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <p>{item.content}</p>
              </article>
            ))
          ) : (
            <p className="status-item status-info">Select a thread to view message history.</p>
          )}
        </div>

        {activeThread ? (
          <div className="workspace-form-stack workspace-chat-reply-box">
            <textarea
              className="workspace-textarea"
              placeholder="Add a new note, saved response, or next-step instruction"
              value={newMessage}
              onChange={(event) => onNewMessageChange(event.target.value)}
              rows={4}
            />
            <button type="button" className="hero-button hero-button-primary" onClick={onSendMessage} disabled={loading}>
              {loading ? "Saving..." : "Save Message"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default ChatHistoryPanel;
