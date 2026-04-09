import React, { useState } from "react";

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Not available";
  }
}

function TeamManagementPanel({
  teams,
  users,
  selectedTeamId,
  teamName,
  teamDescription,
  selectedInviteUserId,
  selectedInviteRole,
  loading,
  error,
  onTeamNameChange,
  onTeamDescriptionChange,
  onCreateTeam,
  onSelectTeam,
  onInviteUserChange,
  onInviteRoleChange,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
}) {
  const [teamSearch, setTeamSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const selectedTeam = teams.find((item) => item.id === selectedTeamId) || teams[0] || null;
  const normalizedTeamSearch = teamSearch.trim().toLowerCase();
  const normalizedMemberSearch = memberSearch.trim().toLowerCase();
  const visibleTeams = normalizedTeamSearch
    ? teams.filter((item) => `${item.name} ${item.description || ""}`.toLowerCase().includes(normalizedTeamSearch))
    : teams;
  const visibleMembers = selectedTeam
    ? selectedTeam.members.filter((member) => {
        if (!normalizedMemberSearch) {
          return true;
        }
        const haystack = `${member.userName || ""} ${member.userEmail || ""} ${member.role} ${member.status}`.toLowerCase();
        return haystack.includes(normalizedMemberSearch);
      })
    : [];
  const activeTeamCount = teams.filter((item) => !item.isPersonal).length;
  const sharedSeats = teams.reduce((sum, item) => sum + (item.memberCount || 0), 0);
  const invitedUserOptions = selectedTeam
    ? users.filter((user) => !selectedTeam.members.some((member) => member.userId === user.id))
    : users;

  return (
    <div className="workspace-premium-shell">
      <section className="workspace-command-hero">
        <article className="workspace-hub-card workspace-command-story workspace-team-premium-hero">
          <div className="workspace-command-topline">
            <div>
              <span className="workspace-command-kicker">Collaboration Command</span>
              <h3 className="workspace-command-title">Team management shaped like a premium operations workspace.</h3>
              <p className="workspace-command-lede">
                Build client pods, internal squads, and shared delivery rooms with cleaner ownership, visible roster health, and a more executive-grade control surface.
              </p>
            </div>
            <div className="workspace-chat-hero-pill">
              <span>Shared teams</span>
              <strong>{activeTeamCount}</strong>
            </div>
          </div>

          <div className="workspace-command-badge-row">
            <article className="workspace-command-badge">
              <span>Total workspaces</span>
              <strong>{teams.length}</strong>
              <p>Personal and collaborative environments available to this account.</p>
            </article>
            <article className="workspace-command-badge">
              <span>Shared seats</span>
              <strong>{sharedSeats}</strong>
              <p>Member assignments currently tracked across all team spaces.</p>
            </article>
            <article className="workspace-command-badge">
              <span>Admins + owners</span>
              <strong>{teams.reduce((sum, item) => sum + (item.adminCount || 0), 0)}</strong>
              <p>Leadership capacity available for approvals and member operations.</p>
            </article>
          </div>
        </article>

        <aside className="workspace-command-sidebar">
          <section className="workspace-hub-card workspace-spotlight-panel">
            <div className="workspace-spotlight-head">
              <span className="workspace-spotlight-tag">Selected workspace</span>
              <span className="workspace-spotlight-time">{formatDate(selectedTeam?.updatedAt || selectedTeam?.createdAt)}</span>
            </div>
            <strong>{selectedTeam?.name || "Choose a workspace"}</strong>
            <p>{selectedTeam?.description || "Select a workspace to review leadership coverage, active seats, and membership controls."}</p>
            <div className="workspace-focus-meta">
              <span>{selectedTeam?.memberCount || 0} members</span>
              <span>{selectedTeam?.adminCount || 0} admins</span>
              <span>{selectedTeam?.pausedMemberCount || 0} paused</span>
            </div>
          </section>
        </aside>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="workspace-command-main">
        <article className="workspace-hub-card workspace-team-create-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">New workspace</span>
              <h4>Create a team environment</h4>
            </div>
            <span className="workspace-section-summary">Production-grade team setup</span>
          </div>
          <div className="workspace-form-stack">
            <input
              type="text"
              className="workspace-input"
              placeholder="Revenue Operations, Enterprise Success, Delivery Pod..."
              value={teamName}
              onChange={(event) => onTeamNameChange(event.target.value)}
            />
            <textarea
              className="workspace-textarea"
              placeholder="Summarize the team mandate, region, client group, or operating scope."
              value={teamDescription}
              onChange={(event) => onTeamDescriptionChange(event.target.value)}
              rows={5}
            />
            <button type="button" className="hero-button hero-button-primary" onClick={onCreateTeam} disabled={loading}>
              {loading ? "Saving..." : "Create Team Workspace"}
            </button>
          </div>
        </article>

        <article className="workspace-hub-card workspace-team-health-card">
          <span className="workspace-hub-eyebrow">Roster health</span>
          <div className="workspace-signal-grid">
            <article className="workspace-signal-tile is-priority workspace-hub-card">
              <span className="workspace-hub-eyebrow">Active members</span>
              <strong>{selectedTeam?.activeMemberCount || 0}</strong>
              <p>Seats currently active inside the selected workspace.</p>
            </article>
            <article className="workspace-signal-tile workspace-hub-card">
              <span className="workspace-hub-eyebrow">Workspace owner</span>
              <strong>{selectedTeam?.ownerName || "Not assigned"}</strong>
              <p>{selectedTeam?.ownerEmail || "Owner details appear here for the selected team."}</p>
            </article>
          </div>
        </article>
      </section>

      <section className="workspace-hub-card workspace-chat-library-card">
        <div className="workspace-section-heading">
          <div>
            <span className="workspace-hub-eyebrow">Workspace directory</span>
            <h4>Move between personal and shared environments</h4>
          </div>
          <span className="workspace-section-summary">{visibleTeams.length} visible</span>
        </div>
        <label className="workspace-search-shell">
          <span>Workspace search</span>
          <input
            type="text"
            className="workspace-input workspace-command-search"
            placeholder="Search team name or description"
            value={teamSearch}
            onChange={(event) => setTeamSearch(event.target.value)}
          />
        </label>

        <div className="workspace-hub-list workspace-chat-thread-grid">
          {visibleTeams.length > 0 ? (
            visibleTeams.map((item) => (
              <article key={item.id} className={`workspace-hub-list-item workspace-chat-thread-tile ${selectedTeam?.id === item.id ? "is-active" : ""}`}>
                <button type="button" className="workspace-card-button" onClick={() => onSelectTeam(item.id)}>
                  <div className="workspace-chat-thread-head">
                    <strong>{item.name}</strong>
                    <span className={`workspace-team-type-tag ${item.isPersonal ? "is-personal" : "is-shared"}`}>
                      {item.isPersonal ? "Personal" : "Shared"}
                    </span>
                  </div>
                  <p>{item.description || "No description provided."}</p>
                  <div className="workspace-hub-inline-meta">
                    <span>{item.memberCount} members</span>
                    <span>{item.adminCount || 0} admins</span>
                    <span>{formatDate(item.updatedAt || item.createdAt)}</span>
                  </div>
                </button>
              </article>
            ))
          ) : (
            <p className="status-item status-info">No team workspaces match this search yet.</p>
          )}
        </div>
      </section>

      {selectedTeam ? (
        <section className="workspace-hub-card workspace-team-roster-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">Roster management</span>
              <h4>{selectedTeam.name}</h4>
            </div>
            <span className="workspace-section-summary">{selectedTeam.isPersonal ? "Private workspace" : "Shared workspace controls"}</span>
          </div>

          <div className="workspace-team-topline-grid">
            <article className="workspace-focus-card">
              <span className="workspace-focus-eyebrow">Workspace brief</span>
              <div className="workspace-focus-record">
                <strong>{selectedTeam.description || "No description provided yet."}</strong>
                <div className="workspace-focus-meta">
                  <span>Owner: {selectedTeam.ownerName || "Not available"}</span>
                  <span>Created: {formatDate(selectedTeam.createdAt)}</span>
                  <span>Updated: {formatDate(selectedTeam.updatedAt)}</span>
                </div>
              </div>
            </article>

            {!selectedTeam.isPersonal ? (
              <article className="workspace-hub-card workspace-team-invite-card">
                <span className="workspace-hub-eyebrow">Invite member</span>
                <div className="workspace-form-stack">
                  <select className="workspace-select" value={selectedInviteUserId} onChange={(event) => onInviteUserChange(event.target.value)}>
                    <option value="">Select user</option>
                    {invitedUserOptions.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName || user.email} {user.publicUserCode ? `(${user.publicUserCode})` : ""}
                      </option>
                    ))}
                  </select>
                  <select className="workspace-select" value={selectedInviteRole} onChange={(event) => onInviteRoleChange(event.target.value)}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button type="button" className="hero-button hero-button-primary" onClick={onAddMember} disabled={loading || !selectedInviteUserId}>
                    {loading ? "Saving..." : "Add Member"}
                  </button>
                </div>
              </article>
            ) : null}
          </div>

          <label className="workspace-search-shell">
            <span>Member search</span>
            <input
              type="text"
              className="workspace-input workspace-command-search"
              placeholder="Search by name, email, role, or status"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
            />
          </label>

          <div className="workspace-chat-message-stream">
            {visibleMembers.length > 0 ? (
              visibleMembers.map((member) => {
                const canEditMember = !selectedTeam.isPersonal && member.role !== "owner";
                return (
                  <article key={member.id} className="workspace-team-member-card">
                    <div className="workspace-chat-bubble-head">
                      <div>
                        <strong>{member.userName || member.userEmail || member.userId}</strong>
                        <p>{member.userEmail || "No email available"}</p>
                      </div>
                      <div className="workspace-team-member-tags">
                        <span className={`workspace-team-role-tag is-${member.role}`}>{member.role}</span>
                        <span className={`workspace-team-status-tag is-${member.status}`}>{member.status}</span>
                      </div>
                    </div>

                    <div className="workspace-hub-inline-meta">
                      <span>Joined {formatDate(member.joinedAt || member.createdAt)}</span>
                      <span>{member.invitedByUserId ? `Invited by ${member.invitedByUserId}` : "Direct member record"}</span>
                    </div>

                    {canEditMember ? (
                      <div className="workspace-hub-actions workspace-team-action-row">
                        <button
                          type="button"
                          className="admin-table-action-button"
                          onClick={() => onUpdateMember(member.id, { role: member.role === "member" ? "admin" : "member" })}
                        >
                          Make {member.role === "member" ? "Admin" : "Member"}
                        </button>
                        <button
                          type="button"
                          className="admin-table-action-button"
                          onClick={() => onUpdateMember(member.id, { status: member.status === "active" ? "paused" : "active" })}
                        >
                          {member.status === "active" ? "Pause Access" : "Resume Access"}
                        </button>
                        <button
                          type="button"
                          className="admin-table-action-button workspace-danger-button"
                          onClick={() => onRemoveMember(member.id)}
                        >
                          Remove Member
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="status-item status-info">No members match this search for the selected workspace.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default TeamManagementPanel;
