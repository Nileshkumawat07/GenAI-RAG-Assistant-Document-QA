import React from "react";

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
}) {
  const selectedTeam = teams.find((item) => item.id === selectedTeamId) || teams[0] || null;

  return (
    <div className="workspace-form-stack workspace-hub-stack">
      <section className="workspace-hub-header">
        <div>
          <h3>Team Management</h3>
          <p>Create shared workspaces, invite people by account, and manage member roles cleanly.</p>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="workspace-hub-grid workspace-hub-grid-wide">
        <section className="workspace-hub-card">
          <h4>Create Team</h4>
          <div className="workspace-form-stack">
            <input
              type="text"
              className="workspace-input"
              placeholder="Team name"
              value={teamName}
              onChange={(event) => onTeamNameChange(event.target.value)}
            />
            <textarea
              className="workspace-textarea"
              placeholder="Short description"
              value={teamDescription}
              onChange={(event) => onTeamDescriptionChange(event.target.value)}
              rows={4}
            />
            <button type="button" className="hero-button hero-button-primary" onClick={onCreateTeam} disabled={loading}>
              {loading ? "Saving..." : "Create Team"}
            </button>
          </div>
        </section>

        <section className="workspace-hub-card">
          <h4>Teams</h4>
          <div className="workspace-hub-list">
            {teams.map((item) => (
              <article key={item.id} className={`workspace-hub-list-item ${selectedTeam?.id === item.id ? "is-active" : ""}`}>
                <button type="button" className="workspace-hub-thread-button" onClick={() => onSelectTeam(item.id)}>
                  <strong>{item.name}</strong>
                  <p>{item.description || "No description provided."}</p>
                </button>
                <span>{item.memberCount}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      {selectedTeam ? (
        <section className="workspace-hub-card">
          <h4>{selectedTeam.name}</h4>
          <p>{selectedTeam.description || "No description provided yet."}</p>

          {!selectedTeam.isPersonal ? (
            <div className="workspace-hub-actions workspace-hub-member-form">
              <select className="workspace-select" value={selectedInviteUserId} onChange={(event) => onInviteUserChange(event.target.value)}>
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName || user.email}
                  </option>
                ))}
              </select>
              <select className="workspace-select" value={selectedInviteRole} onChange={(event) => onInviteRoleChange(event.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button type="button" className="hero-button hero-button-primary" onClick={onAddMember} disabled={loading || !selectedInviteUserId}>
                Add Member
              </button>
            </div>
          ) : null}

          <div className="workspace-hub-list">
            {selectedTeam.members.map((member) => (
              <article key={member.id} className="workspace-hub-list-item">
                <div>
                  <strong>{member.userName || member.userEmail || member.userId}</strong>
                  <p>{member.userEmail || "No email available"} | {member.role} | {member.status}</p>
                </div>
                {!selectedTeam.isPersonal ? (
                  <div className="workspace-hub-actions">
                    <button type="button" className="admin-table-action-button" onClick={() => onUpdateMember(member.id, { role: member.role === "member" ? "admin" : "member" })}>
                      Toggle Role
                    </button>
                    <button type="button" className="admin-table-action-button" onClick={() => onUpdateMember(member.id, { status: member.status === "active" ? "paused" : "active" })}>
                      {member.status === "active" ? "Pause" : "Resume"}
                    </button>
                  </div>
                ) : (
                  <span>{member.status}</span>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default TeamManagementPanel;
