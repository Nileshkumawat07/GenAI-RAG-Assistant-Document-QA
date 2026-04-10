import React from "react";

import { buildChatAuthenticatedUrl } from "./chatManagementApi";

const LEFT_TABS = [
  { id: "chats", label: "Chats" },
  { id: "groups", label: "Groups" },
  { id: "communities", label: "Communities" },
];

const LIST_FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "archived", label: "Archived" },
];

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function ChatRecentListPane({ activeTab, items, listFilter, recentSearch, selectedConversation, typingState, setActiveTab, setListFilter, setRecentSearch, setSelectedConversation }) {
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
      <div className="workspace-chat-tab-row workspace-chat-filter-row">
        {LIST_FILTERS.map((filter) => (
          <button key={filter.id} type="button" className={`workspace-toggle-button ${listFilter === filter.id ? "is-active" : ""}`} onClick={() => setListFilter(filter.id)}>{filter.label}</button>
        ))}
      </div>
      <input className="workspace-input workspace-command-search" value={recentSearch} onChange={(event) => setRecentSearch(event.target.value)} placeholder={`Search ${activeTab}`} />
      <div className="workspace-chat-list">
        {items.length > 0 ? items.map((item) => (
          <button key={`${item.conversationType}-${item.id}`} type="button" className={`workspace-chat-list-item ${selectedConversation?.conversationType === item.conversationType && selectedConversation?.conversationId === item.id ? "is-active" : ""}`} onClick={() => setSelectedConversation({ conversationType: item.conversationType, conversationId: item.id })}>
            <div className="workspace-chat-avatar">
              {item.imageUrl ? <img src={buildChatAuthenticatedUrl(item.imageUrl)} alt={item.title} className="workspace-chat-avatar-image" /> : item.avatarLabel}
            </div>
            <div className="workspace-chat-list-copy">
              <div className="workspace-chat-list-head">
                <strong>{item.title}</strong>
                <span>{formatDate(item.lastMessageAt)}</span>
              </div>
              <p>
                {typingState?.isTyping && typingState.conversationType === item.conversationType && typingState.conversationId === item.id
                  ? "Typing..."
                  : item.lastMessagePreview || item.subtitle || item.statusText}
              </p>
              <span className="workspace-chat-list-status">{item.presenceStatus === "online" ? "Online" : item.statusText}</span>
            </div>
            <div className="workspace-chat-list-meta">
              {item.isPinned ? <span className="workspace-chat-meta-icon" title="Pinned">Pin</span> : null}
              {item.isMuted ? <span className="workspace-chat-meta-icon" title="Muted">Mute</span> : null}
            </div>
            {item.unreadCount > 0 ? <span className="workspace-chat-unread-badge">{item.unreadCount}</span> : null}
          </button>
        )) : <p className="status-item status-info">No items in this tab yet.</p>}
      </div>
    </aside>
  );
}

export default ChatRecentListPane;
