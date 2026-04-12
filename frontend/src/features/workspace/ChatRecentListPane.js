import React, { useEffect, useMemo, useState } from "react";

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

function CreatorModal({ title, subtitle, children, onClose }) {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="workspace-chat-modal-backdrop" onClick={onClose}>
      <div className="workspace-chat-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="workspace-chat-modal-header">
          <div>
            <span className="workspace-hub-eyebrow">Quick actions</span>
            <h4>{title}</h4>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="workspace-chat-icon-button" aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GroupCreator({ createGroupState, setCreateGroupState, overviewFriends, handleCreateGroup, onClose }) {
  const [friendSearch, setFriendSearch] = useState("");

  const filteredFriends = useMemo(() => {
    const query = friendSearch.trim().toLowerCase();
    if (!query) return overviewFriends;
    return overviewFriends.filter((friend) => `${friend.fullName} ${friend.username}`.toLowerCase().includes(query));
  }, [friendSearch, overviewFriends]);

  const selectedCount = createGroupState.memberIds.length;
  const canCreate = createGroupState.name.trim().length >= 3 && selectedCount > 0;

  const toggleFriend = (friendId) => {
    setCreateGroupState((current) => ({
      ...current,
      memberIds: current.memberIds.includes(friendId)
        ? current.memberIds.filter((item) => item !== friendId)
        : [...current.memberIds, friendId],
    }));
  };

  const handleSubmit = async () => {
    if (!canCreate) return;
    const created = await handleCreateGroup();
    if (created) onClose?.();
  };

  return (
    <CreatorModal title="Create Group" subtitle="Start a new conversation with selected friends only." onClose={onClose}>
      <div className="workspace-chat-creator-stack workspace-chat-modal-body">
        <input
          className="workspace-input workspace-command-search"
          value={createGroupState.name}
          onChange={(event) => setCreateGroupState((current) => ({ ...current, name: event.target.value }))}
          placeholder="Group name"
        />
        <textarea
          className="question-input workspace-chat-composer-input workspace-chat-creator-textarea"
          rows={3}
          value={createGroupState.description}
          onChange={(event) => setCreateGroupState((current) => ({ ...current, description: event.target.value }))}
          placeholder="Group description"
        />
        <label className="workspace-chat-attach-button workspace-chat-creator-upload">
          Group photo
          <input type="file" accept="image/*" onChange={(event) => setCreateGroupState((current) => ({ ...current, image: event.target.files?.[0] || null }))} />
        </label>
        <div className="workspace-chat-creator-friends">
          <div className="workspace-chat-creator-friends-head">
            <strong>Select friends</strong>
            <span>{selectedCount} selected</span>
          </div>
          <input className="workspace-input workspace-command-search" value={friendSearch} onChange={(event) => setFriendSearch(event.target.value)} placeholder="Filter friends" />
          <div className="workspace-chat-creator-friend-grid">
            {filteredFriends.length > 0 ? filteredFriends.map((friend) => (
              <button
                key={friend.id}
                type="button"
                className={`workspace-chat-select-card ${createGroupState.memberIds.includes(friend.id) ? "is-selected" : ""}`}
                onClick={() => toggleFriend(friend.id)}
              >
                <div className="workspace-chat-avatar workspace-chat-avatar-list">
                  {friend.imageUrl ? <img src={buildChatAuthenticatedUrl(friend.imageUrl)} alt={friend.fullName} className="workspace-chat-avatar-image" /> : getAvatarLabel(friend.fullName)}
                </div>
                <div className="workspace-chat-select-copy">
                  <strong>{friend.fullName}</strong>
                  <span>@{friend.username}</span>
                </div>
              </button>
            )) : <p className="status-item status-info">No matching friends found.</p>}
          </div>
        </div>
        <div className="workspace-chat-modal-actions">
          <button type="button" className="hero-button hero-button-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="hero-button hero-button-primary" onClick={handleSubmit} disabled={!canCreate}>Create Group</button>
        </div>
      </div>
    </CreatorModal>
  );
}

function CommunityCreator({ createCommunityState, setCreateCommunityState, handleCreateCommunity, onClose }) {
  const canCreate = createCommunityState.name.trim().length >= 3;

  const handleSubmit = async () => {
    if (!canCreate) return;
    const created = await handleCreateCommunity();
    if (created) onClose?.();
  };

  return (
    <CreatorModal title="Create Community" subtitle="Set up a shared space without changing the existing chat flow." onClose={onClose}>
      <div className="workspace-chat-creator-stack workspace-chat-modal-body">
        <input
          className="workspace-input workspace-command-search"
          value={createCommunityState.name}
          onChange={(event) => setCreateCommunityState((current) => ({ ...current, name: event.target.value }))}
          placeholder="Community name"
        />
        <textarea
          className="question-input workspace-chat-composer-input workspace-chat-creator-textarea"
          rows={3}
          value={createCommunityState.description}
          onChange={(event) => setCreateCommunityState((current) => ({ ...current, description: event.target.value }))}
          placeholder="Community description"
        />
        <label className="workspace-chat-attach-button workspace-chat-creator-upload">
          Community photo
          <input type="file" accept="image/*" onChange={(event) => setCreateCommunityState((current) => ({ ...current, image: event.target.files?.[0] || null }))} />
        </label>
        <div className="workspace-chat-modal-actions">
          <button type="button" className="hero-button hero-button-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="hero-button hero-button-primary" onClick={handleSubmit} disabled={!canCreate}>Create Community</button>
        </div>
      </div>
    </CreatorModal>
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
  const [modalType, setModalType] = useState("");
  const profileImageUrl = useMemo(() => buildChatAuthenticatedUrl(currentUser?.profileImageUrl || ""), [currentUser?.profileImageUrl]);

  return (
    <>
      <aside className="workspace-hub-card workspace-chat-column workspace-chat-left-panel">
        <div className="workspace-chat-left-header">
          <div className="workspace-chat-quick-actions-card">
            <div className="workspace-section-heading">
              <div><span className="workspace-hub-eyebrow">Inbox</span><h4>Messages</h4></div>
              <span className="workspace-section-summary">{items.length}</span>
            </div>
            <p className="workspace-chat-quick-actions-copy">Manage chats, groups, and communities from one premium dashboard.</p>
            <div className="workspace-chat-quick-actions-row">
              <button type="button" className="hero-button hero-button-primary" onClick={() => setModalType("group")}>Create Group</button>
              <button type="button" className="hero-button hero-button-secondary" onClick={() => setModalType("community")}>Create Community</button>
            </div>
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

      {modalType === "group" ? (
        <GroupCreator createGroupState={createGroupState} setCreateGroupState={setCreateGroupState} overviewFriends={overviewFriends} handleCreateGroup={handleCreateGroup} onClose={() => setModalType("")} />
      ) : null}

      {modalType === "community" ? (
        <CommunityCreator createCommunityState={createCommunityState} setCreateCommunityState={setCreateCommunityState} handleCreateCommunity={handleCreateCommunity} onClose={() => setModalType("")} />
      ) : null}
    </>
  );
}

export default ChatRecentListPane;
