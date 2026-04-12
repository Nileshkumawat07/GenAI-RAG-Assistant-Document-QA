import React, { useMemo } from "react";

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
    return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function truncateLabel(value, length = 16) {
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function getAvatarLabel(title) {
  if (!title) return "?";
  return title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function GroupCreator({ createGroupState, setCreateGroupState, overviewFriends, handleCreateGroup }) {
  return (
    <div className="workspace-chat-creator-stack">
      <input className="workspace-input workspace-command-search" value={createGroupState.name} onChange={(event) => setCreateGroupState((current) => ({ ...current, name: event.target.value }))} placeholder="Group name" />
      <textarea className="question-input workspace-chat-composer-input workspace-chat-creator-textarea" rows={2} value={createGroupState.description} onChange={(event) => setCreateGroupState((current) => ({ ...current, description: event.target.value }))} placeholder="Group description" />
      <label className="workspace-chat-attach-button workspace-chat-creator-upload">Group photo<input type="file" accept="image/*" onChange={(event) => setCreateGroupState((current) => ({ ...current, image: event.target.files?.[0] || null }))} /></label>
      <div className="workspace-chat-chip-row workspace-chat-creator-chip-row">
        {overviewFriends.map((friend) => (
          <button key={friend.id} type="button" className={`workspace-inline-action ${createGroupState.memberIds.includes(friend.id) ? "is-active" : ""}`} onClick={() => setCreateGroupState((current) => ({ ...current, memberIds: current.memberIds.includes(friend.id) ? current.memberIds.filter((item) => item !== friend.id) : [...current.memberIds, friend.id] }))}>
            {truncateLabel(friend.fullName, 18)}
          </button>
        ))}
      </div>
      <button type="button" className="hero-button hero-button-secondary" onClick={handleCreateGroup}>Create Group</button>
    </div>
  );
}

function CommunityCreator({ createCommunityState, setCreateCommunityState, handleCreateCommunity }) {
  return (
    <div className="workspace-chat-creator-stack">
      <input className="workspace-input workspace-command-search" value={createCommunityState.name} onChange={(event) => setCreateCommunityState((current) => ({ ...current, name: event.target.value }))} placeholder="Community name" />
      <textarea className="question-input workspace-chat-composer-input workspace-chat-creator-textarea" rows={2} value={createCommunityState.description} onChange={(event) => setCreateCommunityState((current) => ({ ...current, description: event.target.value }))} placeholder="Community description" />
      <label className="workspace-chat-attach-button workspace-chat-creator-upload">Community photo<input type="file" accept="image/*" onChange={(event) => setCreateCommunityState((current) => ({ ...current, image: event.target.files?.[0] || null }))} /></label>
      <button type="button" className="hero-button hero-button-secondary" onClick={handleCreateCommunity}>Create Community</button>
    </div>
  );
}

function ChatRecentListPane({
  activeTab,
  items,
  listFilter,
  recentSearch,
  selectedConversation,
  typingState,
  currentUser,
  setActiveTab,
  setListFilter,
  setRecentSearch,
  setSelectedConversation,
  createGroupState,
  setCreateGroupState,
  handleCreateGroup,
  createCommunityState,
  setCreateCommunityState,
  handleCreateCommunity,
  overviewFriends,
  onOpenSelfProfile,
  onOpenSettings,
}) {
  const profileImageUrl = useMemo(() => buildChatAuthenticatedUrl(currentUser?.profileImageUrl || ""), [currentUser?.profileImageUrl]);

  return (
    <aside className="workspace-hub-card workspace-chat-column workspace-chat-left-panel">
      <div className="workspace-chat-left-header">
        <div className="workspace-section-heading">
          <div><span className="workspace-hub-eyebrow">Recent chats</span><h4>Messages</h4></div>
          <span className="workspace-section-summary">{items.length}</span>
        </div>
        <input className="workspace-input workspace-command-search" value={recentSearch} onChange={(event) => setRecentSearch(event.target.value)} placeholder={`Search ${activeTab}`} />

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

        {activeTab === "groups" ? (
          <div className="workspace-chat-creator-panel">
            <GroupCreator createGroupState={createGroupState} setCreateGroupState={setCreateGroupState} overviewFriends={overviewFriends} handleCreateGroup={handleCreateGroup} />
          </div>
        ) : null}

        {activeTab === "communities" ? (
          <div className="workspace-chat-creator-panel">
            <CommunityCreator createCommunityState={createCommunityState} setCreateCommunityState={setCreateCommunityState} handleCreateCommunity={handleCreateCommunity} />
          </div>
        ) : null}
      </div>

      <div className="workspace-chat-list">
        {items.length > 0 ? items.map((item) => {
          const isTyping = typingState?.isTyping && typingState.conversationType === item.conversationType && typingState.conversationId === item.id;
          const avatarUrl = item.imageUrl ? buildChatAuthenticatedUrl(item.imageUrl) : "";

          return (
            <button key={`${item.conversationType}-${item.id}`} type="button" className={`workspace-chat-list-item workspace-chat-list-card ${selectedConversation?.conversationType === item.conversationType && selectedConversation?.conversationId === item.id ? "is-active" : ""}`} onClick={() => setSelectedConversation({ conversationType: item.conversationType, conversationId: item.id })}>
              <div className="workspace-chat-avatar workspace-chat-avatar-list">
                {avatarUrl ? <img src={avatarUrl} alt={item.title} className="workspace-chat-avatar-image" /> : item.avatarLabel || getAvatarLabel(item.title)}
              </div>
              <div className="workspace-chat-list-copy">
                <div className="workspace-chat-list-head">
                  <strong title={item.title}>{truncateLabel(item.title, 16)}</strong>
                  <span>{formatDate(item.lastMessageAt)}</span>
                </div>
                <p title={isTyping ? "typing..." : item.lastMessagePreview || item.subtitle || item.statusText}>
                  {isTyping ? "typing..." : truncateLabel(item.lastMessagePreview || item.subtitle || item.statusText, 28)}
                </p>
              </div>
              <div className="workspace-chat-list-side">
                <div className="workspace-chat-list-icons">
                  {item.isMuted ? <span className="workspace-chat-meta-icon" title="Muted">&#128263;</span> : null}
                  {item.isPinned ? <span className="workspace-chat-meta-icon" title="Pinned">&#128204;</span> : null}
                </div>
                {item.unreadCount > 0 ? <span className="workspace-chat-unread-badge">{item.unreadCount}</span> : <span className={`workspace-chat-presence-dot ${item.presenceStatus === "online" ? "is-online" : ""}`} />}
              </div>
            </button>
          );
        }) : <p className="status-item status-info">No items in this tab yet.</p>}
      </div>

      <div className="workspace-chat-self-card">
        <button type="button" className="workspace-chat-self-main" onClick={onOpenSelfProfile}>
          <div className="workspace-chat-avatar workspace-chat-avatar-list">
            {profileImageUrl ? <img src={profileImageUrl} alt={currentUser?.fullName || "Profile"} className="workspace-chat-avatar-image" /> : getAvatarLabel(currentUser?.fullName || currentUser?.name || "You")}
          </div>
          <div className="workspace-chat-self-copy">
            <strong title={currentUser?.fullName || currentUser?.name || "You"}>{truncateLabel(currentUser?.fullName || currentUser?.name || "You", 18)}</strong>
            <span>Profile</span>
          </div>
        </button>
        <button type="button" className="workspace-chat-self-settings" onClick={onOpenSettings} aria-label="Settings">&#9881;</button>
      </div>
    </aside>
  );
}

export default ChatRecentListPane;
