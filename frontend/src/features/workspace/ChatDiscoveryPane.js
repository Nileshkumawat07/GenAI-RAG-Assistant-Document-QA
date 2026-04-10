import React from "react";

function ChatDiscoveryPane({
  overview,
  searchQuery,
  setSearchQuery,
  searchResults,
  searchLoading,
  handleSendFriendRequest,
  createGroupState,
  setCreateGroupState,
  handleCreateGroup,
  createCommunityState,
  setCreateCommunityState,
  handleCreateCommunity,
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
  setDetails,
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
  clearSelection,
}) {
  return (
    <aside className="workspace-hub-card workspace-chat-column">
      <div className="workspace-section-heading">
        <div><span className="workspace-hub-eyebrow">Discovery</span><h4>Actions & settings</h4></div>
        <span className="workspace-section-summary">{searchLoading ? "Searching" : "Live search"}</span>
      </div>
      <input className="workspace-input workspace-command-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search people to add" />
      <div className="workspace-chat-discovery-list">
        {searchResults.map((user) => (
          <article key={user.id} className="workspace-chat-discovery-card">
            <div className="workspace-chat-avatar">{user.avatarLabel}</div>
            <div><strong>{user.fullName}</strong><p>@{user.username} · {user.presenceStatus}</p></div>
            <button type="button" className="admin-table-action-button" disabled={user.relationshipState !== "none"} onClick={() => handleSendFriendRequest(user.id)}>{user.relationshipState === "none" ? "Add Friend" : user.relationshipState.replace("_", " ")}</button>
          </article>
        ))}
      </div>

      <div className="workspace-chat-side-section">
        <div className="workspace-section-heading"><div><span className="workspace-hub-eyebrow">Create</span><h4>Group</h4></div></div>
        <input className="workspace-input workspace-command-search" value={createGroupState.name} onChange={(event) => setCreateGroupState((current) => ({ ...current, name: event.target.value }))} placeholder="Group name" />
        <textarea className="question-input workspace-chat-composer-input" rows={2} value={createGroupState.description} onChange={(event) => setCreateGroupState((current) => ({ ...current, description: event.target.value }))} placeholder="Group description" />
        <label className="workspace-chat-attach-button">Group image<input type="file" accept="image/*" onChange={(event) => setCreateGroupState((current) => ({ ...current, image: event.target.files?.[0] || null }))} /></label>
        <div className="workspace-chat-chip-row">
          {overviewFriends.map((friend) => <button key={friend.id} type="button" className={`workspace-inline-action ${createGroupState.memberIds.includes(friend.id) ? "is-active" : ""}`} onClick={() => setCreateGroupState((current) => ({ ...current, memberIds: current.memberIds.includes(friend.id) ? current.memberIds.filter((item) => item !== friend.id) : [...current.memberIds, friend.id] }))}>{friend.fullName}</button>)}
        </div>
        <button type="button" className="hero-button hero-button-secondary" onClick={handleCreateGroup}>Create Group</button>
      </div>

      <div className="workspace-chat-side-section">
        <div className="workspace-section-heading"><div><span className="workspace-hub-eyebrow">Create</span><h4>Community</h4></div></div>
        <input className="workspace-input workspace-command-search" value={createCommunityState.name} onChange={(event) => setCreateCommunityState((current) => ({ ...current, name: event.target.value }))} placeholder="Community name" />
        <textarea className="question-input workspace-chat-composer-input" rows={2} value={createCommunityState.description} onChange={(event) => setCreateCommunityState((current) => ({ ...current, description: event.target.value }))} placeholder="Community description" />
        <label className="workspace-chat-attach-button">Community image<input type="file" accept="image/*" onChange={(event) => setCreateCommunityState((current) => ({ ...current, image: event.target.files?.[0] || null }))} /></label>
        <button type="button" className="hero-button hero-button-secondary" onClick={handleCreateCommunity}>Create Community</button>
      </div>

      {details ? (
        <div className="workspace-chat-side-section">
          <div className="workspace-section-heading"><div><span className="workspace-hub-eyebrow">Settings</span><h4>{details.name}</h4></div></div>
          <div className="workspace-chat-detail-stack">
            <p>{details.description || "No description yet."}</p>
            {"groupType" in details ? (
              <>
                <button type="button" className="admin-table-action-button" onClick={() => updateGroup(details.id, { isMuted: !details.isMuted }).then(setDetails).catch((error) => setPanelError(error.message))}>{details.isMuted ? "Unmute notifications" : "Mute notifications"}</button>
                {canManageMembers ? <div className="workspace-chat-chip-row">{overviewFriends.map((friend) => <button key={friend.id} type="button" className={`workspace-inline-action ${memberInviteIds.includes(friend.id) ? "is-active" : ""}`} onClick={() => setMemberInviteIds((current) => current.includes(friend.id) ? current.filter((item) => item !== friend.id) : [...current, friend.id])}>{friend.fullName}</button>)}</div> : null}
                {canManageMembers ? <button type="button" className="admin-table-action-button" onClick={() => addGroupMembers(details.id, memberInviteIds).then(setDetails).then(() => loadOverview()).catch((error) => setPanelError(error.message))}>Add selected members</button> : null}
                <div className="workspace-chat-member-list">
                  {details.members.map((member) => (
                    <article key={member.id} className="workspace-chat-member-card">
                      <strong>{member.user.fullName}</strong>
                      <p>{member.role}</p>
                      {canManageMembers && member.userId !== currentUser?.id ? <div className="workspace-chat-inline-actions">
                        <button type="button" className="inline-text-button" onClick={() => updateGroupMemberRole(details.id, member.userId, member.role === "admin" ? "member" : "admin").then(setDetails).catch((error) => setPanelError(error.message))}>{member.role === "admin" ? "Demote" : "Promote"}</button>
                        <button type="button" className="inline-text-button" onClick={() => removeGroupMember(details.id, member.userId).then(setDetails).then(() => loadOverview()).catch((error) => setPanelError(error.message))}>Remove</button>
                      </div> : null}
                    </article>
                  ))}
                </div>
                <div className="workspace-chat-inline-actions">
                  <button type="button" className="inline-text-button" onClick={() => exitGroup(details.id).then(() => { clearSelection(); loadOverview(); }).catch((error) => setPanelError(error.message))}>Exit group</button>
                  {details.currentUserRole === "admin" ? <button type="button" className="inline-text-button" onClick={() => deleteGroup(details.id).then(() => { clearSelection(); loadOverview(); }).catch((error) => setPanelError(error.message))}>Delete group</button> : null}
                </div>
              </>
            ) : (
              <>
                <button type="button" className="admin-table-action-button" onClick={() => updateCommunity(details.id, { isMuted: !details.isMuted }).then(setDetails).catch((error) => setPanelError(error.message))}>{details.isMuted ? "Unmute announcements" : "Mute announcements"}</button>
                <div className="workspace-chat-chip-row">
                  {overviewGroups.map((group) => <button key={group.id} type="button" className={`workspace-inline-action ${communityGroupId === group.id ? "is-active" : ""}`} onClick={() => setCommunityGroupId(group.id)}>{group.title}</button>)}
                </div>
                {canManageMembers ? <button type="button" className="admin-table-action-button" onClick={() => addGroupToCommunity(details.id, communityGroupId).then(setDetails).catch((error) => setPanelError(error.message))}>Add group to community</button> : null}
                <div className="workspace-chat-member-list">
                  {details.groups.map((group) => (
                    <article key={group.id} className="workspace-chat-member-card">
                      <strong>{group.name}</strong>
                      <p>{group.memberCount} members</p>
                      {canManageMembers ? <button type="button" className="inline-text-button" onClick={() => removeGroupFromCommunity(details.id, group.id).then(setDetails).catch((error) => setPanelError(error.message))}>Remove group</button> : null}
                    </article>
                  ))}
                </div>
                <div className="workspace-chat-inline-actions">
                  <button type="button" className="inline-text-button" onClick={() => joinCommunity(details.id).then(setDetails).then(() => loadOverview()).catch((error) => setPanelError(error.message))}>Join</button>
                  <button type="button" className="inline-text-button" onClick={() => leaveCommunity(details.id).then(() => { clearSelection(); loadOverview(); }).catch((error) => setPanelError(error.message))}>Leave</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div ref={requestsRef} className={`workspace-chat-side-section ${requestFocus ? "is-focus" : ""}`}>
        <div className="workspace-section-heading"><div><span className="workspace-hub-eyebrow">Requests</span><h4>Received</h4></div><span className="workspace-section-summary">{overview.receivedRequests.length}</span></div>
        <div className="workspace-chat-request-list">
          {overview.receivedRequests.length > 0 ? overview.receivedRequests.map((item) => (
            <article key={item.id} className="workspace-chat-request-card">
              <strong>{item.sender.fullName}</strong>
              <p>@{item.sender.username}</p>
              <div className="workspace-hub-actions">
                <button type="button" className="admin-table-action-button" onClick={() => handleRequestAction(item.id, "accept")}>Accept</button>
                <button type="button" className="admin-table-action-button" onClick={() => handleRequestAction(item.id, "reject")}>Reject</button>
              </div>
            </article>
          )) : <p className="status-item status-info">No received requests.</p>}
        </div>
      </div>

      <div className="workspace-chat-side-section">
        <div className="workspace-section-heading"><div><span className="workspace-hub-eyebrow">Requests</span><h4>Sent</h4></div><span className="workspace-section-summary">{overview.sentRequests.length}</span></div>
        <div className="workspace-chat-request-list">
          {overview.sentRequests.length > 0 ? overview.sentRequests.map((item) => <article key={item.id} className="workspace-chat-request-card"><strong>{item.receiver.fullName}</strong><p>@{item.receiver.username}</p></article>) : <p className="status-item status-info">No sent requests.</p>}
        </div>
      </div>
    </aside>
  );
}

export default ChatDiscoveryPane;
