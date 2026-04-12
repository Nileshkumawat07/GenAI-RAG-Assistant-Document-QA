import React from "react";

import { buildChatAuthenticatedUrl, buildChatFileUrl } from "./chatManagementApi";

function DiscoverySectionTitle({ eyebrow, title, summary, icon }) {
  return (
    <div className="workspace-chat-section-heading">
      <div className="workspace-chat-section-heading-main">
        <span className="workspace-chat-section-icon" aria-hidden="true">{icon}</span>
        <div>
          <span className="workspace-hub-eyebrow">{eyebrow}</span>
          <h4>{title}</h4>
        </div>
      </div>
      {summary ? <span className="workspace-section-summary">{summary}</span> : null}
    </div>
  );
}

function ChatDiscoveryPane({
  overview,
  searchQuery,
  setSearchQuery,
  searchResults,
  searchLoading,
  handleSendFriendRequest,
  handleOpenSearchMessage,
  createGroupState,
  setCreateGroupState,
  handleCreateGroup,
  createCommunityState,
  setCreateCommunityState,
  handleCreateCommunity,
  selectedConversation,
  details,
  canManageMembers,
  memberInviteIds,
  setMemberInviteIds,
  communityGroupId,
  setCommunityGroupId,
  currentUser,
  requestsRef,
  requestFocus,
  handleRequestAction,
  refreshSelectedConversation,
  setPanelError,
  loadOverview,
  addGroupMembers,
  addGroupToCommunity,
  deleteGroup,
  exitGroup,
  joinCommunity,
  leaveCommunity,
  overviewGroups,
  overviewFriends,
  removeGroupFromCommunity,
  removeGroupMember,
  updateCommunity,
  updateGroup,
  updateGroupMemberRole,
  handleDeleteCommunity,
  clearSelection,
}) {
  const runAndRefresh = async (action, clearAfter = false) => {
    try {
      await action();
      await loadOverview();
      if (clearAfter) {
        clearSelection();
        return;
      }
      await refreshSelectedConversation?.();
    } catch (error) {
      setPanelError(error.message || "Failed to update conversation.");
    }
  };

  const isDirect = details?.conversationType === "direct";
  const isGroup = details?.conversationType === "group";
  const isCommunity = details?.conversationType === "community";
  const isCommunityCreator = isCommunity && details?.createdByUserId === currentUser?.id;

  return (
    <aside className="workspace-hub-card workspace-chat-column workspace-chat-discovery-panel">
      <div className="workspace-section-heading">
        <div><span className="workspace-hub-eyebrow">Discovery</span><h4>Actions & settings</h4></div>
        <span className="workspace-section-summary">{searchLoading ? "Searching" : "Live search"}</span>
      </div>
      <input className="workspace-input workspace-command-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search people to add" />

      <div className="workspace-chat-discovery-scroll">
        <div className="workspace-chat-discovery-list">
          {(searchResults?.users || []).map((user) => (
            <article key={user.id} className="workspace-chat-discovery-card">
              <div className="workspace-chat-avatar">{user.imageUrl ? <img src={buildChatAuthenticatedUrl(user.imageUrl)} alt={user.fullName} className="workspace-chat-avatar-image" /> : user.avatarLabel}</div>
              <div><strong>{user.fullName}</strong><p>@{user.username} | {user.presenceStatus}</p></div>
              <button type="button" className="admin-table-action-button" disabled={user.relationshipState !== "none"} onClick={() => handleSendFriendRequest(user.id)}>{user.relationshipState === "none" ? "Add Friend" : user.relationshipState.replace("_", " ")}</button>
            </article>
          ))}
          {(searchResults?.messages || []).map((item) => (
            <article key={item.messageId} className="workspace-chat-discovery-card workspace-chat-search-message-card">
              <div>
                <strong>{item.conversationTitle}</strong>
                <p>{item.senderName}</p>
                <p>{item.snippet}</p>
              </div>
              <button
                type="button"
                className="admin-table-action-button"
                onClick={() => handleOpenSearchMessage?.({ conversationType: item.conversationType, conversationId: item.conversationId, messageId: item.messageId })}
              >
                Jump to message
              </button>
            </article>
          ))}
          {searchQuery.trim() && !searchLoading && !(searchResults?.users?.length || searchResults?.messages?.length) ? <p className="status-item status-info">No people or messages matched this search.</p> : null}
        </div>

        <div className="workspace-chat-side-section workspace-chat-settings-card">
          <DiscoverySectionTitle eyebrow="Create" title="Group" icon="◫" />
          <input className="workspace-input workspace-command-search" value={createGroupState.name} onChange={(event) => setCreateGroupState((current) => ({ ...current, name: event.target.value }))} placeholder="Group name" />
          <textarea className="question-input workspace-chat-composer-input" rows={2} value={createGroupState.description} onChange={(event) => setCreateGroupState((current) => ({ ...current, description: event.target.value }))} placeholder="Group description" />
          <label className="workspace-chat-attach-button">Group image<input type="file" accept="image/*" onChange={(event) => setCreateGroupState((current) => ({ ...current, image: event.target.files?.[0] || null }))} /></label>
          <div className="workspace-chat-chip-row">{overviewFriends.map((friend) => <button key={friend.id} type="button" className={`workspace-inline-action ${createGroupState.memberIds.includes(friend.id) ? "is-active" : ""}`} onClick={() => setCreateGroupState((current) => ({ ...current, memberIds: current.memberIds.includes(friend.id) ? current.memberIds.filter((item) => item !== friend.id) : [...current.memberIds, friend.id] }))}>{friend.fullName}</button>)}</div>
          <button type="button" className="hero-button hero-button-secondary" onClick={handleCreateGroup}>Create Group</button>
        </div>

        <div className="workspace-chat-side-section workspace-chat-settings-card">
          <DiscoverySectionTitle eyebrow="Create" title="Community" icon="◎" />
          <input className="workspace-input workspace-command-search" value={createCommunityState.name} onChange={(event) => setCreateCommunityState((current) => ({ ...current, name: event.target.value }))} placeholder="Community name" />
          <textarea className="question-input workspace-chat-composer-input" rows={2} value={createCommunityState.description} onChange={(event) => setCreateCommunityState((current) => ({ ...current, description: event.target.value }))} placeholder="Community description" />
          <label className="workspace-chat-attach-button">Community image<input type="file" accept="image/*" onChange={(event) => setCreateCommunityState((current) => ({ ...current, image: event.target.files?.[0] || null }))} /></label>
          <button type="button" className="hero-button hero-button-secondary" onClick={handleCreateCommunity}>Create Community</button>
        </div>

        {details ? (
          <div className="workspace-chat-side-section workspace-chat-settings-card">
            <div className="workspace-chat-side-section workspace-chat-settings-subcard">
              <DiscoverySectionTitle eyebrow="Shared media" title={`${details.sharedMedia?.length || 0} items`} icon="▣" />
              <div className="workspace-chat-member-list">
                {(details.sharedMedia || []).map((item) => <a key={item.id} href={buildChatFileUrl(item.id)} target="_blank" rel="noreferrer" className="workspace-chat-member-card workspace-chat-media-card"><strong>{item.fileName || item.messageType}</strong><p>{item.senderName}</p></a>)}
                {!details.sharedMedia?.length ? <p className="status-item status-info">No shared media yet.</p> : null}
              </div>
            </div>

            <div className="workspace-chat-side-section workspace-chat-settings-subcard">
              <DiscoverySectionTitle eyebrow="Starred" title="Messages" icon="★" />
              <div className="workspace-chat-member-list">{(details.starredMessages || []).map((item) => <article key={item.id} className="workspace-chat-member-card"><strong>{item.senderName}</strong><p>{item.body || item.fileName || item.messageType}</p></article>)}{!details.starredMessages?.length ? <p className="status-item status-info">No starred messages yet.</p> : null}</div>
            </div>

            <div className="workspace-chat-side-section workspace-chat-settings-subcard">
              <DiscoverySectionTitle eyebrow="Pinned" title="Messages" icon="⌘" />
              <div className="workspace-chat-member-list">{(details.pinnedMessages || []).map((item) => <article key={item.id} className="workspace-chat-member-card"><strong>{item.senderName}</strong><p>{item.body || item.fileName || item.messageType}</p></article>)}{!details.pinnedMessages?.length ? <p className="status-item status-info">No pinned messages yet.</p> : null}</div>
            </div>

            {(isGroup || isCommunity) ? (
              <div className="workspace-chat-side-section workspace-chat-settings-subcard">
                <DiscoverySectionTitle eyebrow="Members" title={`${details.memberCount}`} icon="◉" />
                {isGroup && canManageMembers ? <><div className="workspace-chat-chip-row">{overviewFriends.map((friend) => <button key={friend.id} type="button" className={`workspace-inline-action ${memberInviteIds.includes(friend.id) ? "is-active" : ""}`} onClick={() => setMemberInviteIds((current) => current.includes(friend.id) ? current.filter((item) => item !== friend.id) : [...current, friend.id])}>{friend.fullName}</button>)}</div><button type="button" className="admin-table-action-button" onClick={() => runAndRefresh(() => addGroupMembers(selectedConversation.conversationId, memberInviteIds))}>Add selected members</button></> : null}
                <div className="workspace-chat-member-list">{(details.members || []).map((member) => <article key={member.id} className="workspace-chat-member-card"><strong>{member.user.fullName}</strong><p>{member.role}</p>{isGroup && canManageMembers && member.userId !== currentUser?.id ? <div className="workspace-chat-inline-actions"><button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => updateGroupMemberRole(selectedConversation.conversationId, member.userId, member.role === "admin" ? "member" : "admin"))}>{member.role === "admin" ? "Demote" : "Promote"}</button><button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => removeGroupMember(selectedConversation.conversationId, member.userId))}>Remove</button></div> : null}</article>)}</div>
              </div>
            ) : null}

            {isCommunity ? (
              <div className="workspace-chat-side-section workspace-chat-settings-subcard">
                <DiscoverySectionTitle eyebrow="Groups" title={`${details.groups?.length || 0}`} icon="▥" />
                {canManageMembers ? <><div className="workspace-chat-chip-row">{overviewGroups.map((group) => <button key={group.id} type="button" className={`workspace-inline-action ${communityGroupId === group.id ? "is-active" : ""}`} onClick={() => setCommunityGroupId(group.id)}>{group.title}</button>)}</div><button type="button" className="admin-table-action-button" onClick={() => runAndRefresh(() => addGroupToCommunity(selectedConversation.conversationId, communityGroupId))}>Add group</button></> : null}
                <div className="workspace-chat-member-list">{(details.groups || []).map((group) => <article key={group.id} className="workspace-chat-member-card"><strong>{group.name}</strong><p>{group.memberCount} members</p>{canManageMembers ? <button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => removeGroupFromCommunity(selectedConversation.conversationId, group.id))}>Remove</button> : null}</article>)}</div>
              </div>
            ) : null}

            {isGroup ? <div className="workspace-chat-inline-actions"><button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => exitGroup(selectedConversation.conversationId), true)}>Exit group</button>{details.currentUserRole === "admin" ? <button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => deleteGroup(selectedConversation.conversationId), true)}>Delete group</button> : null}<button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => updateGroup(selectedConversation.conversationId, { isMuted: !details.preferences?.isMuted }))}>{details.preferences?.isMuted ? "Unmute notifications" : "Mute notifications"}</button></div> : null}
            {isCommunity ? (
              <div className="workspace-chat-inline-actions">
                <button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => joinCommunity(selectedConversation.conversationId))}>Join</button>
                {isCommunityCreator ? (
                  <button
                    type="button"
                    className="inline-text-button"
                    onClick={() => {
                      if (window.confirm(`Delete ${details.title} community permanently?`)) {
                        handleDeleteCommunity?.();
                      }
                    }}
                  >
                    Delete community
                  </button>
                ) : (
                  <button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => leaveCommunity(selectedConversation.conversationId), true)}>Leave</button>
                )}
                <button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => updateCommunity(selectedConversation.conversationId, { isMuted: !details.preferences?.isMuted }))}>{details.preferences?.isMuted ? "Unmute announcements" : "Mute announcements"}</button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div ref={requestsRef} className={`workspace-chat-side-section ${requestFocus ? "is-focus" : ""}`}>
          <div className="workspace-section-heading"><div><span className="workspace-hub-eyebrow">Requests</span><h4>Received</h4></div><span className="workspace-section-summary">{overview.receivedRequests.length}</span></div>
          <div className="workspace-chat-request-list">{overview.receivedRequests.length > 0 ? overview.receivedRequests.map((item) => <article key={item.id} className="workspace-chat-request-card"><strong>{item.sender.fullName}</strong><p>@{item.sender.username}</p><div className="workspace-hub-actions"><button type="button" className="admin-table-action-button" onClick={() => handleRequestAction(item.id, "accept")}>Accept</button><button type="button" className="admin-table-action-button" onClick={() => handleRequestAction(item.id, "reject")}>Reject</button></div></article>) : <p className="status-item status-info">No received requests.</p>}</div>
        </div>

        <div className="workspace-chat-side-section">
          <div className="workspace-section-heading"><div><span className="workspace-hub-eyebrow">Requests</span><h4>Sent</h4></div><span className="workspace-section-summary">{overview.sentRequests.length}</span></div>
          <div className="workspace-chat-request-list">{overview.sentRequests.length > 0 ? overview.sentRequests.map((item) => <article key={item.id} className="workspace-chat-request-card"><strong>{item.receiver.fullName}</strong><p>@{item.receiver.username}</p></article>) : <p className="status-item status-info">No sent requests.</p>}</div>
        </div>
      </div>
    </aside>
  );
}

export default ChatDiscoveryPane;
