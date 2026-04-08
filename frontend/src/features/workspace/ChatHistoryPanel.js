import React from "react";

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
}) {
  return (
    <div className="workspace-form-stack workspace-hub-stack">
      <section className="workspace-hub-header">
        <div>
          <h3>Chat History</h3>
          <p>Save prompt threads, keep assistant notes, and continue conversations over time.</p>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="workspace-hub-grid workspace-hub-grid-wide">
        <section className="workspace-hub-card">
          <h4>Create Thread</h4>
          <div className="workspace-form-stack">
            <input
              type="text"
              className="workspace-input"
              placeholder="Thread title"
              value={threadTitle}
              onChange={(event) => onThreadTitleChange(event.target.value)}
            />
            <textarea
              className="workspace-textarea"
              placeholder="Optional opening note"
              value={threadMessage}
              onChange={(event) => onThreadMessageChange(event.target.value)}
              rows={4}
            />
            <button type="button" className="hero-button hero-button-primary" onClick={onCreateThread} disabled={loading}>
              {loading ? "Saving..." : "Create Thread"}
            </button>
          </div>
        </section>

        <section className="workspace-hub-card">
          <h4>Saved Threads</h4>
          <div className="workspace-hub-list">
            {threads.length > 0 ? (
              threads.map((item) => (
                <article key={item.id} className={`workspace-hub-list-item ${activeThreadId === item.id ? "is-active" : ""}`}>
                  <button type="button" className="workspace-hub-thread-button" onClick={() => onSelectThread(item.id)}>
                    <strong>{item.title}</strong>
                    <p>{item.lastMessagePreview || "No preview yet."}</p>
                  </button>
                  <span>{item.messageCount}</span>
                </article>
              ))
            ) : (
              <p className="status-item status-info">No chat threads yet.</p>
            )}
          </div>
        </section>
      </div>

      <section className="workspace-hub-card">
        <h4>Thread Messages</h4>
        <div className="workspace-hub-list">
          {messages.length > 0 ? (
            messages.map((item) => (
              <article key={item.id} className="workspace-hub-list-item">
                <div>
                  <strong>{item.role}</strong>
                  <p>{item.content}</p>
                </div>
                <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : "Saved now"}</span>
              </article>
            ))
          ) : (
            <p className="status-item status-info">Select a thread to view message history.</p>
          )}
        </div>

        {activeThreadId ? (
          <div className="workspace-form-stack">
            <textarea
              className="workspace-textarea"
              placeholder="Add a new message to this thread"
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
