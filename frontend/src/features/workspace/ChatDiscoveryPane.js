import React, { useEffect, useMemo, useRef, useState } from "react";

import { changePassword, fetchSettingsCategory, saveSettingsCategory, updateProfile } from "../auth/authApi";
import { resetFirebaseRecaptcha, sendFirebaseOtp, verifyFirebaseOtp } from "../../shared/firebase/phoneAuth";
import { buildChatAuthenticatedUrl, buildChatFileUrl, uploadChatProfilePhoto } from "./chatManagementApi";

const SETTINGS_TABS = ["account", "security", "notifications", "privacy", "chat", "storage"];
const DEFAULT_SETTINGS = {
  security: { twoStepEnabled: false, otpChannel: "sms" },
  notifications: { messageNotifications: true, groupNotifications: true, communityNotifications: true, inAppToasts: true },
  privacy: { lastSeenVisibility: "contacts", profileVisibility: "contacts", readReceiptsEnabled: true },
  chat: { autoDownloadMedia: true, autoDownloadPhotos: true, autoDownloadVideos: false, autoDownloadFiles: false },
};

function formatBytes(value) {
  const size = Number(value || 0);
  if (!size) return "0 B";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function labelize(value) {
  return value.replace(/[A-Z]/g, (match) => ` ${match}`).replace(/^./, (char) => char.toUpperCase());
}

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
  handleUpdateConversationPreference,
  handleClearConversation,
  handleDeleteConversationMedia,
  handleChatProfileUpdated,
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
  handleRemoveFriend,
  handleDeleteCommunity,
  clearSelection,
}) {
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState("");
  const [accountForm, setAccountForm] = useState({ fullName: "", bio: "", image: null });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [otpState, setOtpState] = useState({ confirmation: null, code: "", sending: false, verifying: false });
  const otpRecaptchaId = useRef(`chat-otp-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    setAccountForm({ fullName: currentUser?.fullName || currentUser?.name || "", bio: currentUser?.bio || "", image: null });
  }, [currentUser?.bio, currentUser?.fullName, currentUser?.name]);

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        setSettingsLoading(true);
        const [security, notifications, privacy, chat] = await Promise.all([
          fetchSettingsCategory("chat-security"),
          fetchSettingsCategory("chat-notifications"),
          fetchSettingsCategory("chat-privacy"),
          fetchSettingsCategory("chat-preferences"),
        ]);
        if (!active) return;
        setSettings({
          security: { ...DEFAULT_SETTINGS.security, ...(security?.payload?.form || {}) },
          notifications: { ...DEFAULT_SETTINGS.notifications, ...(notifications?.payload?.form || {}) },
          privacy: { ...DEFAULT_SETTINGS.privacy, ...(privacy?.payload?.form || {}) },
          chat: { ...DEFAULT_SETTINGS.chat, ...(chat?.payload?.form || {}) },
        });
      } catch (error) {
        if (active) setPanelError(error.message || "Failed to load chat settings.");
      } finally {
        if (active) setSettingsLoading(false);
      }
    };
    if (currentUser?.id) loadSettings();
    return () => {
      active = false;
      resetFirebaseRecaptcha(otpRecaptchaId.current).catch(() => {});
    };
  }, [currentUser?.id, setPanelError]);

  const detailImageUrl = useMemo(() => buildChatAuthenticatedUrl(details?.imageUrl || ""), [details?.imageUrl]);

  const saveCategory = async (category, form, stateKey) => {
    try {
      setSettingsSaving(category);
      await saveSettingsCategory(category, { form });
      setSettings((current) => ({ ...current, [stateKey]: form }));
      await refreshSelectedConversation?.();
    } catch (error) {
      setPanelError(error.message || "Failed to save chat settings.");
    } finally {
      setSettingsSaving("");
    }
  };

  const saveAccount = async () => {
    try {
      setSettingsSaving("account");
      await updateProfile({
        userId: currentUser.id,
        fullName: accountForm.fullName,
        dateOfBirth: currentUser.dateOfBirth,
        gender: currentUser.gender,
        alternateEmail: currentUser.alternateEmail || null,
        bio: accountForm.bio,
      });
      if (accountForm.image) await uploadChatProfilePhoto(accountForm.image);
      await handleChatProfileUpdated?.();
      setAccountForm((current) => ({ ...current, image: null }));
    } catch (error) {
      setPanelError(error.message || "Failed to update account profile.");
    } finally {
      setSettingsSaving("");
    }
  };

  const savePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) return setPanelError("Enter the current and new password.");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return setPanelError("Confirm the new password before saving.");
    try {
      setSettingsSaving("security");
      await changePassword({ userId: currentUser.id, currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      setPanelError(error.message || "Failed to update password.");
    } finally {
      setSettingsSaving("");
    }
  };

  const sendOtp = async () => {
    try {
      setOtpState((current) => ({ ...current, sending: true }));
      const confirmation = await sendFirebaseOtp(currentUser.mobile, otpRecaptchaId.current);
      setOtpState({ confirmation, code: "", sending: false, verifying: false });
    } catch (error) {
      setOtpState((current) => ({ ...current, sending: false }));
      setPanelError(error.message || "Failed to send OTP.");
    }
  };

  const verifyOtp = async () => {
    if (!otpState.confirmation || !otpState.code.trim()) return setPanelError("Send the OTP first, then enter the code.");
    try {
      setOtpState((current) => ({ ...current, verifying: true }));
      await verifyFirebaseOtp(otpState.confirmation, otpState.code.trim());
      await saveCategory("chat-security", { ...settings.security, twoStepEnabled: true }, "security");
      setOtpState({ confirmation: null, code: "", sending: false, verifying: false });
    } catch (error) {
      setOtpState((current) => ({ ...current, verifying: false }));
      setPanelError(error.message || "Failed to verify OTP.");
    }
  };

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
            <div className="workspace-chat-sidebar-profile">
              <div className="workspace-chat-avatar workspace-chat-avatar-large">{detailImageUrl ? <img src={detailImageUrl} alt={details.title} className="workspace-chat-avatar-image" /> : details.avatarLabel}</div>
              <strong>{details.title}</strong>
              <p>{details.bio || details.subtitle || details.statusText || "No details yet."}</p>
            </div>

            <div className="workspace-chat-chip-row">
              <button type="button" className={`workspace-inline-action ${details.preferences?.isMuted ? "is-active" : ""}`} onClick={() => handleUpdateConversationPreference({ isMuted: !details.preferences?.isMuted })}>{details.preferences?.isMuted ? "Unmute" : "Mute"}</button>
              <button type="button" className={`workspace-inline-action ${details.preferences?.isPinned ? "is-active" : ""}`} onClick={() => handleUpdateConversationPreference({ isPinned: !details.preferences?.isPinned })}>{details.preferences?.isPinned ? "Unpin" : "Pin"}</button>
              <button type="button" className={`workspace-inline-action ${details.preferences?.isArchived ? "is-active" : ""}`} onClick={() => handleUpdateConversationPreference({ isArchived: !details.preferences?.isArchived })}>{details.preferences?.isArchived ? "Unarchive" : "Archive"}</button>
              {isDirect ? <button type="button" className={`workspace-inline-action ${details.preferences?.isBlocked ? "is-active" : ""}`} onClick={() => handleUpdateConversationPreference({ isBlocked: !details.preferences?.isBlocked })}>{details.preferences?.isBlocked ? "Unblock" : "Block"}</button> : null}
              {isDirect ? (
                <button
                  type="button"
                  className="workspace-inline-action workspace-inline-action-danger"
                  onClick={() => {
                    if (window.confirm(`Remove ${details.title} from friends and delete this direct chat?`)) {
                      handleRemoveFriend?.();
                    }
                  }}
                >
                  Remove friend
                </button>
              ) : null}
            </div>

            <label className="workspace-form-stack">
              <span>Disappearing messages</span>
              <select className="workspace-input workspace-command-search" value={details.preferences?.disappearingMode || "off"} onChange={(event) => handleUpdateConversationPreference({ disappearingMode: event.target.value })}>
                <option value="off">Off</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="90d">90 days</option>
              </select>
            </label>

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

            <div className="workspace-chat-side-section workspace-chat-settings-subcard">
              <DiscoverySectionTitle eyebrow="Settings" title="Chat controls" icon="✦" />
              <div className="workspace-chat-tab-row">{SETTINGS_TABS.map((tab) => <button key={tab} type="button" className={`workspace-toggle-button ${activeSettingsTab === tab ? "is-active" : ""}`} onClick={() => setActiveSettingsTab(tab)}>{labelize(tab)}</button>)}</div>
              {settingsLoading ? <p className="status-item status-info">Loading chat settings...</p> : null}
              {activeSettingsTab === "account" ? <div className="workspace-form-stack"><input className="workspace-input workspace-command-search" value={accountForm.fullName} onChange={(event) => setAccountForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Display name" /><textarea className="question-input workspace-chat-composer-input" rows={3} value={accountForm.bio} onChange={(event) => setAccountForm((current) => ({ ...current, bio: event.target.value }))} placeholder="Bio" /><label className="workspace-chat-attach-button">Profile photo<input type="file" accept="image/*" onChange={(event) => setAccountForm((current) => ({ ...current, image: event.target.files?.[0] || null }))} /></label><button type="button" className="hero-button hero-button-secondary" onClick={saveAccount} disabled={settingsSaving === "account"}>Save account</button></div> : null}
              {activeSettingsTab === "security" ? <div className="workspace-form-stack"><input className="workspace-input workspace-command-search" type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} placeholder="Current password" /><input className="workspace-input workspace-command-search" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} placeholder="New password" /><input className="workspace-input workspace-command-search" type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Confirm new password" /><button type="button" className="hero-button hero-button-secondary" onClick={savePassword} disabled={settingsSaving === "security"}>Change password</button><select className="workspace-input workspace-command-search" value={settings.security.otpChannel} onChange={(event) => setSettings((current) => ({ ...current, security: { ...current.security, otpChannel: event.target.value, twoStepEnabled: current.security.twoStepEnabled } }))}><option value="sms">SMS OTP</option><option value="email">Email OTP</option></select><div id={otpRecaptchaId.current} /><div className="workspace-chat-inline-actions"><button type="button" className="inline-text-button" onClick={() => saveCategory("chat-security", { ...settings.security, twoStepEnabled: false }, "security")}>Disable 2-step</button><button type="button" className="inline-text-button" onClick={sendOtp} disabled={otpState.sending}>{otpState.sending ? "Sending..." : "Send OTP"}</button></div><input className="workspace-input workspace-command-search" value={otpState.code} onChange={(event) => setOtpState((current) => ({ ...current, code: event.target.value }))} placeholder="Enter OTP" /><button type="button" className="hero-button hero-button-secondary" onClick={verifyOtp} disabled={otpState.verifying}>{otpState.verifying ? "Verifying..." : "Verify & enable"}</button></div> : null}
              {activeSettingsTab === "notifications" ? <div className="workspace-form-stack">{Object.entries(settings.notifications).map(([key, value]) => <label key={key} className="workspace-chat-setting-row"><span>{labelize(key)}</span><input type="checkbox" checked={Boolean(value)} onChange={(event) => setSettings((current) => ({ ...current, notifications: { ...current.notifications, [key]: event.target.checked } }))} /></label>)}<button type="button" className="hero-button hero-button-secondary" onClick={() => saveCategory("chat-notifications", settings.notifications, "notifications")} disabled={settingsSaving === "chat-notifications"}>Save notifications</button></div> : null}
              {activeSettingsTab === "privacy" ? <div className="workspace-form-stack"><select className="workspace-input workspace-command-search" value={settings.privacy.lastSeenVisibility} onChange={(event) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, lastSeenVisibility: event.target.value } }))}><option value="everyone">Last seen: everyone</option><option value="contacts">Last seen: contacts</option><option value="nobody">Last seen: nobody</option></select><select className="workspace-input workspace-command-search" value={settings.privacy.profileVisibility} onChange={(event) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, profileVisibility: event.target.value } }))}><option value="everyone">Profile: everyone</option><option value="contacts">Profile: contacts</option><option value="nobody">Profile: nobody</option></select><label className="workspace-chat-setting-row"><span>Read receipts</span><input type="checkbox" checked={Boolean(settings.privacy.readReceiptsEnabled)} onChange={(event) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, readReceiptsEnabled: event.target.checked } }))} /></label><button type="button" className="hero-button hero-button-secondary" onClick={() => saveCategory("chat-privacy", settings.privacy, "privacy")} disabled={settingsSaving === "chat-privacy"}>Save privacy</button></div> : null}
              {activeSettingsTab === "chat" ? <div className="workspace-form-stack">{Object.entries(settings.chat).map(([key, value]) => <label key={key} className="workspace-chat-setting-row"><span>{labelize(key)}</span><input type="checkbox" checked={Boolean(value)} onChange={(event) => setSettings((current) => ({ ...current, chat: { ...current.chat, [key]: event.target.checked } }))} /></label>)}<button type="button" className="hero-button hero-button-secondary" onClick={() => saveCategory("chat-preferences", settings.chat, "chat")} disabled={settingsSaving === "chat-preferences"}>Save chat settings</button>{selectedConversation ? <button type="button" className="admin-table-action-button" onClick={handleClearConversation}>Clear chat</button> : null}</div> : null}
              {activeSettingsTab === "storage" ? <div className="workspace-form-stack"><div className="workspace-chat-storage-grid"><article className="workspace-chat-member-card"><strong>{formatBytes(details.storage?.totalBytes)}</strong><p>Total storage</p></article><article className="workspace-chat-member-card"><strong>{details.storage?.totalFiles || 0}</strong><p>Total files</p></article><article className="workspace-chat-member-card"><strong>{details.storage?.imageCount || 0}</strong><p>Images</p></article><article className="workspace-chat-member-card"><strong>{details.storage?.videoCount || 0}</strong><p>Videos</p></article><article className="workspace-chat-member-card"><strong>{details.storage?.voiceCount || 0}</strong><p>Voice</p></article><article className="workspace-chat-member-card"><strong>{details.storage?.fileCount || 0}</strong><p>Files</p></article></div><button type="button" className="hero-button hero-button-secondary" onClick={handleDeleteConversationMedia}>Delete media</button></div> : null}
            </div>

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
