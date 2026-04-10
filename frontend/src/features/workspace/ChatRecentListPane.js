import React from "react";

const LEFT_TABS = [
  { id: "chats", label: "Chats" },
  { id: "groups", label: "Groups" },
  { id: "communities", label: "Communities" },
];

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function ChatRecentListPane({ activeTab, items, recentSearch, selectedConversation, setActiveTab, setRecentSearch, setSelectedConversation }) {
  return (
    <aside className="workspace-hub-card workspace-chat-column">
      <div className="workspace-section-heading">
        <div><span className="workspace-hub-eyebrow">Recent chats</span><h4>Switcher</h4></div>
        <span className="workspace-section-summary">{items.length}</span>
      </div>
      <div className="workspace-chat-tab-row">
        {LEFT_TABS.map((tab) => (
          <button key={tab.id} type="button" className={`workspace-toggle-button ${activeTab === tab.id ? "is-active" : ""}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </div>
      <input className="workspace-input workspace-command-search" value={recentSearch} onChange={(event) => setRecentSearch(event.target.value)} placeholder={`Search ${activeTab}`} />
      <div className="workspace-chat-list">
        {items.length > 0 ? items.map((item) => (
          <button key={`${item.conversationType}-${item.id}`} type="button" className={`workspace-chat-list-item ${selectedConversation?.conversationType === item.conversationType && selectedConversation?.conversationId === item.id ? "is-active" : ""}`} onClick={() => setSelectedConversation({ conversationType: item.conversationType, conversationId: item.id })}>
            <div className="workspace-chat-avatar">{item.avatarLabel}</div>
            <div className="workspace-chat-list-copy">
              <div className="workspace-chat-list-head"><strong>{item.title}</strong><span>{formatDate(item.lastMessageAt)}</span></div>
              <p>{item.lastMessagePreview || item.subtitle || item.statusText}</p>
            </div>
            {item.unreadCount > 0 ? <span className="workspace-chat-unread-badge">{item.unreadCount}</span> : null}
          </button>
        )) : <p className="status-item status-info">No items in this tab yet.</p>}
      </div>
    </aside>
  );
}

export default ChatRecentListPane;
