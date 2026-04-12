import React, { useEffect, useMemo, useRef, useState } from "react";

import { changePassword, fetchSettingsCategory, saveSettingsCategory, updateProfile } from "../auth/authApi";
import { resetFirebaseRecaptcha, sendFirebaseOtp, verifyFirebaseOtp } from "../../shared/firebase/phoneAuth";
import { buildChatAuthenticatedUrl, uploadChatProfilePhoto } from "./chatManagementApi";

const TABS = ["profile", "account", "privacy", "notifications", "storage"];
const DEFAULTS = {
  security: { twoStepEnabled: false, otpChannel: "sms" },
  notifications: { messageNotifications: true, groupNotifications: true, communityNotifications: true, sounds: true },
  privacy: { lastSeenVisibility: "contacts", profileVisibility: "contacts", aboutVisibility: "contacts", readReceiptsEnabled: true },
  chat: { autoDownloadMedia: true, autoDownloadPhotos: true, autoDownloadVideos: false, autoDownloadFiles: false },
};

const bytes = (value) => {
  const size = Number(value || 0);
  if (!size) return "0 B";
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
};

const labelize = (value) => value.replace(/[A-Z]/g, (match) => ` ${match}`).replace(/^./, (char) => char.toUpperCase());
const avatarLabel = (title) => (title || "?").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
const statusLine = (details) => details?.presenceStatus === "online" ? "Online" : details?.lastSeenAt ? `Last seen ${new Date(details.lastSeenAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : details?.statusText || details?.subtitle || "Profile";

function ChatProfilePanel({
  currentUser,
  selectedConversation,
  details,
  mode,
  onClose,
  setPanelError,
  handleUpdateConversationPreference,
  handleClearConversation,
  handleDeleteConversationMedia,
  handleChatProfileUpdated,
  refreshSelectedConversation,
  handleRemoveFriend,
  canManageMembers,
  memberInviteIds,
  setMemberInviteIds,
  communityGroupId,
  setCommunityGroupId,
  loadOverview,
  addGroupMembers,
  addGroupToCommunity,
  deleteGroup,
  exitGroup,
  leaveCommunity,
  overviewGroups,
  overviewFriends,
  removeGroupFromCommunity,
  removeGroupMember,
  updateCommunity,
  updateGroup,
  updateGroupMemberRole,
  handleDeleteCommunity,
}) {
  const [tab, setTab] = useState("profile");
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [account, setAccount] = useState({ fullName: "", bio: "", image: null });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [otp, setOtp] = useState({ confirmation: null, code: "", sending: false, verifying: false });
  const otpRecaptchaId = useRef(`chat-profile-otp-${Math.random().toString(36).slice(2, 10)}`);
  const isSelf = mode === "self-profile" || mode === "settings";
  const isSettings = mode === "settings";
  const title = isSelf ? (currentUser?.fullName || currentUser?.name || "You") : details?.title || "Profile";
  const bio = isSelf ? currentUser?.bio || "Add a bio" : details?.bio || "No bio available yet.";
  const imageUrl = useMemo(() => buildChatAuthenticatedUrl(isSelf ? currentUser?.profileImageUrl || "" : details?.imageUrl || ""), [currentUser?.profileImageUrl, details?.imageUrl, isSelf]);

  useEffect(() => {
    setAccount({ fullName: currentUser?.fullName || currentUser?.name || "", bio: currentUser?.bio || "", image: null });
  }, [currentUser?.bio, currentUser?.fullName, currentUser?.name]);

  useEffect(() => {
    if (!isSelf || !currentUser?.id) return undefined;
    let active = true;
    Promise.all([
      fetchSettingsCategory("chat-security"),
      fetchSettingsCategory("chat-notifications"),
      fetchSettingsCategory("chat-privacy"),
      fetchSettingsCategory("chat-preferences"),
    ]).then(([security, notifications, privacy, chat]) => {
      if (!active) return;
      setSettings({
        security: { ...DEFAULTS.security, ...(security?.payload?.form || {}) },
        notifications: { ...DEFAULTS.notifications, ...(notifications?.payload?.form || {}) },
        privacy: { ...DEFAULTS.privacy, ...(privacy?.payload?.form || {}) },
        chat: { ...DEFAULTS.chat, ...(chat?.payload?.form || {}) },
      });
    }).catch((error) => active && setPanelError(error.message || "Failed to load settings.")).finally(() => active && setLoading(false));
    setLoading(true);
    return () => {
      active = false;
      resetFirebaseRecaptcha(otpRecaptchaId.current).catch(() => {});
    };
  }, [currentUser?.id, isSelf, setPanelError]);

  const saveCategory = async (category, form, stateKey) => {
    try {
      setSaving(category);
      await saveSettingsCategory(category, { form });
      setSettings((current) => ({ ...current, [stateKey]: form }));
      await refreshSelectedConversation?.();
    } catch (error) {
      setPanelError(error.message || "Failed to save settings.");
    } finally {
      setSaving("");
    }
  };

  const saveAccount = async () => {
    try {
      setSaving("account");
      await updateProfile({ userId: currentUser.id, fullName: account.fullName, dateOfBirth: currentUser.dateOfBirth, gender: currentUser.gender, alternateEmail: currentUser.alternateEmail || null, bio: account.bio });
      if (account.image) await uploadChatProfilePhoto(account.image);
      await handleChatProfileUpdated?.();
      setAccount((current) => ({ ...current, image: null }));
    } catch (error) {
      setPanelError(error.message || "Failed to update profile.");
    } finally {
      setSaving("");
    }
  };

  const savePassword = async () => {
    if (!password.currentPassword || !password.newPassword) return setPanelError("Enter the current and new password.");
    if (password.newPassword !== password.confirmPassword) return setPanelError("Confirm the new password before saving.");
    try {
      setSaving("security");
      await changePassword({ userId: currentUser.id, currentPassword: password.currentPassword, newPassword: password.newPassword });
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      setPanelError(error.message || "Failed to update password.");
    } finally {
      setSaving("");
    }
  };

  const sendOtp = async () => {
    try {
      setOtp((current) => ({ ...current, sending: true }));
      const confirmation = await sendFirebaseOtp(currentUser.mobile, otpRecaptchaId.current);
      setOtp({ confirmation, code: "", sending: false, verifying: false });
    } catch (error) {
      setOtp((current) => ({ ...current, sending: false }));
      setPanelError(error.message || "Failed to send OTP.");
    }
  };

  const verifyOtp = async () => {
    if (!otp.confirmation || !otp.code.trim()) return setPanelError("Send the OTP first, then enter the code.");
    try {
      setOtp((current) => ({ ...current, verifying: true }));
      await verifyFirebaseOtp(otp.confirmation, otp.code.trim());
      await saveCategory("chat-security", { ...settings.security, twoStepEnabled: true }, "security");
      setOtp({ confirmation: null, code: "", sending: false, verifying: false });
    } catch (error) {
      setOtp((current) => ({ ...current, verifying: false }));
      setPanelError(error.message || "Failed to verify OTP.");
    }
  };

  const runAndRefresh = async (action, clearAfter = false) => {
    try {
      await action();
      await loadOverview?.();
      if (!clearAfter) await refreshSelectedConversation?.();
    } catch (error) {
      setPanelError(error.message || "Failed to update group or community.");
    }
  };

  return (
    <section className="workspace-hub-card workspace-chat-conversation-card workspace-chat-profile-panel">
      <div className="workspace-chat-profile-header">
        <button type="button" className="workspace-chat-icon-button" aria-label="Back to conversation" onClick={onClose}><span aria-hidden="true">&#8592;</span></button>
        <div className="workspace-chat-profile-header-copy">
          <strong>{title}</strong>
          <span>{isSettings ? "Settings" : "Profile"}</span>
        </div>
      </div>

      <div className="workspace-chat-profile-scroll">
        <div className="workspace-chat-profile-hero">
          <div className="workspace-chat-avatar workspace-chat-avatar-xl">{imageUrl ? <img src={imageUrl} alt={title} className="workspace-chat-avatar-image" /> : avatarLabel(title)}</div>
          <h3>{title}</h3>
          <p>{statusLine(isSelf ? { subtitle: currentUser?.email || "Your account" } : details)}</p>
          <span>{bio}</span>
        </div>

        {isSelf ? (
          <article className="workspace-chat-settings-card">
            <div className="workspace-chat-section-heading"><div className="workspace-chat-section-heading-main"><span className="workspace-chat-section-icon" aria-hidden="true">PR</span><div><span className="workspace-hub-eyebrow">Profile</span><h4>Edit profile</h4></div></div></div>
            <div className="workspace-form-stack">
              <input className="workspace-input workspace-command-search" value={account.fullName} onChange={(event) => setAccount((current) => ({ ...current, fullName: event.target.value }))} placeholder="Name" />
              <textarea className="question-input workspace-chat-composer-input workspace-chat-creator-textarea" rows={3} value={account.bio} onChange={(event) => setAccount((current) => ({ ...current, bio: event.target.value }))} placeholder="Bio" />
              <label className="workspace-chat-attach-button workspace-chat-creator-upload">Profile photo<input type="file" accept="image/*" onChange={(event) => setAccount((current) => ({ ...current, image: event.target.files?.[0] || null }))} /></label>
              <button type="button" className="hero-button hero-button-secondary" onClick={saveAccount} disabled={saving === "account"}>Save profile</button>
            </div>
          </article>
        ) : null}

        {isSettings ? (
          <article className="workspace-chat-settings-card">
            <div className="workspace-chat-section-heading"><div className="workspace-chat-section-heading-main"><span className="workspace-chat-section-icon" aria-hidden="true">SE</span><div><span className="workspace-hub-eyebrow">Settings</span><h4>Account controls</h4></div></div></div>
            <div className="workspace-chat-tab-row workspace-chat-profile-tab-row">{TABS.map((item) => <button key={item} type="button" className={`workspace-toggle-button ${tab === item ? "is-active" : ""}`} onClick={() => setTab(item)}>{labelize(item)}</button>)}</div>
            {loading ? <p className="status-item status-info">Loading settings...</p> : null}
            {tab === "profile" ? <div className="workspace-form-stack"><input className="workspace-input workspace-command-search" value={account.fullName} onChange={(event) => setAccount((current) => ({ ...current, fullName: event.target.value }))} placeholder="Edit name" /><textarea className="question-input workspace-chat-composer-input workspace-chat-creator-textarea" rows={3} value={account.bio} onChange={(event) => setAccount((current) => ({ ...current, bio: event.target.value }))} placeholder="Edit bio" /><label className="workspace-chat-attach-button workspace-chat-creator-upload">Change photo<input type="file" accept="image/*" onChange={(event) => setAccount((current) => ({ ...current, image: event.target.files?.[0] || null }))} /></label><button type="button" className="hero-button hero-button-secondary" onClick={saveAccount} disabled={saving === "account"}>Save profile</button></div> : null}
            {tab === "account" ? <div className="workspace-form-stack"><input className="workspace-input workspace-command-search" type="password" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} placeholder="Current password" /><input className="workspace-input workspace-command-search" type="password" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} placeholder="New password" /><input className="workspace-input workspace-command-search" type="password" value={password.confirmPassword} onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Confirm new password" /><button type="button" className="hero-button hero-button-secondary" onClick={savePassword} disabled={saving === "security"}>Change password</button><input className="workspace-input workspace-command-search" value={currentUser?.email || currentUser?.alternateEmail || ""} readOnly /><input className="workspace-input workspace-command-search" value={currentUser?.mobile || ""} readOnly /><select className="workspace-input workspace-command-search" value={settings.security.otpChannel} onChange={(event) => setSettings((current) => ({ ...current, security: { ...current.security, otpChannel: event.target.value, twoStepEnabled: current.security.twoStepEnabled } }))}><option value="sms">SMS OTP</option><option value="email">Email OTP</option></select><div id={otpRecaptchaId.current} /><div className="workspace-chat-inline-actions"><button type="button" className="inline-text-button" onClick={() => saveCategory("chat-security", { ...settings.security, twoStepEnabled: false }, "security")}>Disable 2FA</button><button type="button" className="inline-text-button" onClick={sendOtp} disabled={otp.sending}>{otp.sending ? "Sending..." : "Send OTP"}</button></div><input className="workspace-input workspace-command-search" value={otp.code} onChange={(event) => setOtp((current) => ({ ...current, code: event.target.value }))} placeholder="Enter OTP" /><button type="button" className="hero-button hero-button-secondary" onClick={verifyOtp} disabled={otp.verifying}>{otp.verifying ? "Verifying..." : "Verify & enable"}</button></div> : null}
            {tab === "privacy" ? <div className="workspace-form-stack"><select className="workspace-input workspace-command-search" value={settings.privacy.lastSeenVisibility} onChange={(event) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, lastSeenVisibility: event.target.value } }))}><option value="everyone">Last seen: everyone</option><option value="contacts">Last seen: contacts</option><option value="nobody">Last seen: nobody</option></select><select className="workspace-input workspace-command-search" value={settings.privacy.profileVisibility} onChange={(event) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, profileVisibility: event.target.value } }))}><option value="everyone">Profile: everyone</option><option value="contacts">Profile: contacts</option><option value="nobody">Profile: nobody</option></select><select className="workspace-input workspace-command-search" value={settings.privacy.aboutVisibility} onChange={(event) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, aboutVisibility: event.target.value } }))}><option value="everyone">About: everyone</option><option value="contacts">About: contacts</option><option value="nobody">About: nobody</option></select><label className="workspace-chat-setting-row"><span>Read receipts</span><input type="checkbox" checked={Boolean(settings.privacy.readReceiptsEnabled)} onChange={(event) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, readReceiptsEnabled: event.target.checked } }))} /></label><button type="button" className="hero-button hero-button-secondary" onClick={() => saveCategory("chat-privacy", settings.privacy, "privacy")} disabled={saving === "chat-privacy"}>Save privacy</button></div> : null}
            {tab === "notifications" ? <div className="workspace-form-stack">{Object.entries(settings.notifications).map(([key, value]) => <label key={key} className="workspace-chat-setting-row"><span>{labelize(key)}</span><input type="checkbox" checked={Boolean(value)} onChange={(event) => setSettings((current) => ({ ...current, notifications: { ...current.notifications, [key]: event.target.checked } }))} /></label>)}<button type="button" className="hero-button hero-button-secondary" onClick={() => saveCategory("chat-notifications", settings.notifications, "notifications")} disabled={saving === "chat-notifications"}>Save notifications</button></div> : null}
            {tab === "storage" ? <div className="workspace-chat-storage-grid"><article className="workspace-chat-member-card"><strong>{bytes(details?.storage?.totalBytes)}</strong><p>Storage usage</p></article><article className="workspace-chat-member-card"><strong>{details?.storage?.totalFiles || 0}</strong><p>Files</p></article><article className="workspace-chat-member-card"><strong>{settings.chat.autoDownloadMedia ? "On" : "Off"}</strong><p>Media auto-download</p></article><label className="workspace-chat-setting-row"><span>Auto download media</span><input type="checkbox" checked={Boolean(settings.chat.autoDownloadMedia)} onChange={(event) => setSettings((current) => ({ ...current, chat: { ...current.chat, autoDownloadMedia: event.target.checked } }))} /></label><label className="workspace-chat-setting-row"><span>Auto download photos</span><input type="checkbox" checked={Boolean(settings.chat.autoDownloadPhotos)} onChange={(event) => setSettings((current) => ({ ...current, chat: { ...current.chat, autoDownloadPhotos: event.target.checked } }))} /></label><label className="workspace-chat-setting-row"><span>Auto download videos</span><input type="checkbox" checked={Boolean(settings.chat.autoDownloadVideos)} onChange={(event) => setSettings((current) => ({ ...current, chat: { ...current.chat, autoDownloadVideos: event.target.checked } }))} /></label><label className="workspace-chat-setting-row"><span>Auto download files</span><input type="checkbox" checked={Boolean(settings.chat.autoDownloadFiles)} onChange={(event) => setSettings((current) => ({ ...current, chat: { ...current.chat, autoDownloadFiles: event.target.checked } }))} /></label><button type="button" className="hero-button hero-button-secondary" onClick={() => saveCategory("chat-preferences", settings.chat, "chat")} disabled={saving === "chat-preferences"}>Save storage</button></div> : null}
          </article>
        ) : null}

        {!isSelf && details?.conversationType === "direct" ? (
          <>
            <article className="workspace-chat-settings-card">
              <div className="workspace-chat-section-heading"><div className="workspace-chat-section-heading-main"><span className="workspace-chat-section-icon" aria-hidden="true">IN</span><div><span className="workspace-hub-eyebrow">Contact</span><h4>About</h4></div></div></div>
              <div className="workspace-chat-profile-detail-list"><div className="workspace-chat-profile-detail-item"><span>Name</span><strong>{details?.title}</strong></div><div className="workspace-chat-profile-detail-item"><span>About</span><strong>{details?.bio || "No bio available"}</strong></div><div className="workspace-chat-profile-detail-item"><span>Status</span><strong>{statusLine(details)}</strong></div></div>
            </article>
            <article className="workspace-chat-settings-card"><div className="workspace-chat-section-heading"><div className="workspace-chat-section-heading-main"><span className="workspace-chat-section-icon" aria-hidden="true">MD</span><div><span className="workspace-hub-eyebrow">Shared media</span><h4>Recent items</h4></div></div></div><div className="workspace-chat-member-list">{(details?.sharedMedia || []).slice(0, 6).map((item) => <article key={item.id} className="workspace-chat-member-card"><strong>{item.fileName || item.messageType}</strong><p>{item.senderName}</p></article>)}{!details?.sharedMedia?.length ? <p className="status-item status-info">No shared media yet.</p> : null}</div></article>
            <article className="workspace-chat-settings-card"><div className="workspace-chat-section-heading"><div className="workspace-chat-section-heading-main"><span className="workspace-chat-section-icon" aria-hidden="true">AC</span><div><span className="workspace-hub-eyebrow">Conversation</span><h4>Actions</h4></div></div></div><div className="workspace-chat-chip-row workspace-chat-profile-action-grid"><button type="button" className={`workspace-inline-action ${details?.preferences?.isMuted ? "is-active" : ""}`} onClick={() => handleUpdateConversationPreference({ isMuted: !details?.preferences?.isMuted })}>{details?.preferences?.isMuted ? "Unmute" : "Mute"}</button><button type="button" className={`workspace-inline-action ${details?.preferences?.isBlocked ? "is-active" : ""}`} onClick={() => handleUpdateConversationPreference({ isBlocked: !details?.preferences?.isBlocked })}>{details?.preferences?.isBlocked ? "Unblock" : "Block user"}</button><button type="button" className="workspace-inline-action" onClick={() => window.alert("Report submitted.")}>Report user</button>{selectedConversation ? <button type="button" className="workspace-inline-action" onClick={handleClearConversation}>Clear chat</button> : null}{selectedConversation ? <button type="button" className="workspace-inline-action" onClick={handleDeleteConversationMedia}>Delete media</button> : null}<button type="button" className="workspace-inline-action workspace-inline-action-danger" onClick={() => { if (window.confirm(`Remove ${details?.title} from your chats?`)) { handleRemoveFriend?.(); onClose?.(); } }}>Remove friend</button></div></article>
          </>
        ) : null}

        {!isSelf && (details?.conversationType === "group" || details?.conversationType === "community") ? (
          <>
            <article className="workspace-chat-settings-card"><div className="workspace-chat-section-heading"><div className="workspace-chat-section-heading-main"><span className="workspace-chat-section-icon" aria-hidden="true">MB</span><div><span className="workspace-hub-eyebrow">{details?.conversationType === "group" ? "Group" : "Community"}</span><h4>Members</h4></div></div></div>{details?.conversationType === "group" && canManageMembers ? <><div className="workspace-chat-chip-row workspace-chat-profile-action-grid">{overviewFriends.map((friend) => <button key={friend.id} type="button" className={`workspace-inline-action ${memberInviteIds.includes(friend.id) ? "is-active" : ""}`} onClick={() => setMemberInviteIds((current) => current.includes(friend.id) ? current.filter((item) => item !== friend.id) : [...current, friend.id])}>{friend.fullName}</button>)}</div><button type="button" className="hero-button hero-button-secondary" onClick={() => runAndRefresh(() => addGroupMembers(selectedConversation.conversationId, memberInviteIds))}>Add members</button></> : null}<div className="workspace-chat-member-list">{(details?.members || []).map((member) => <article key={member.id} className="workspace-chat-member-card"><strong>{member.user.fullName}</strong><p>{member.role}</p>{details?.conversationType === "group" && canManageMembers && member.userId !== currentUser?.id ? <div className="workspace-chat-inline-actions"><button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => updateGroupMemberRole(selectedConversation.conversationId, member.userId, member.role === "admin" ? "member" : "admin"))}>{member.role === "admin" ? "Remove admin" : "Make admin"}</button><button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => removeGroupMember(selectedConversation.conversationId, member.userId))}>Remove</button></div> : null}</article>)}</div></article>
            {details?.conversationType === "community" ? <article className="workspace-chat-settings-card"><div className="workspace-chat-section-heading"><div className="workspace-chat-section-heading-main"><span className="workspace-chat-section-icon" aria-hidden="true">GP</span><div><span className="workspace-hub-eyebrow">Community</span><h4>Groups</h4></div></div></div>{canManageMembers ? <><div className="workspace-chat-chip-row workspace-chat-profile-action-grid">{overviewGroups.map((group) => <button key={group.id} type="button" className={`workspace-inline-action ${communityGroupId === group.id ? "is-active" : ""}`} onClick={() => setCommunityGroupId(group.id)}>{group.title}</button>)}</div><button type="button" className="hero-button hero-button-secondary" onClick={() => runAndRefresh(() => addGroupToCommunity(selectedConversation.conversationId, communityGroupId))}>Add group</button></> : null}<div className="workspace-chat-member-list">{(details?.groups || []).map((group) => <article key={group.id} className="workspace-chat-member-card"><strong>{group.name}</strong><p>{group.memberCount} members</p>{canManageMembers ? <button type="button" className="inline-text-button" onClick={() => runAndRefresh(() => removeGroupFromCommunity(selectedConversation.conversationId, group.id))}>Remove</button> : null}</article>)}</div></article> : null}
            <article className="workspace-chat-settings-card"><div className="workspace-chat-section-heading"><div className="workspace-chat-section-heading-main"><span className="workspace-chat-section-icon" aria-hidden="true">ST</span><div><span className="workspace-hub-eyebrow">Settings</span><h4>{details?.conversationType === "group" ? "Group settings" : "Community settings"}</h4></div></div></div><div className="workspace-chat-chip-row workspace-chat-profile-action-grid"><button type="button" className={`workspace-inline-action ${details?.preferences?.isMuted ? "is-active" : ""}`} onClick={() => runAndRefresh(() => (details?.conversationType === "group" ? updateGroup(selectedConversation.conversationId, { isMuted: !details?.preferences?.isMuted }) : updateCommunity(selectedConversation.conversationId, { isMuted: !details?.preferences?.isMuted })))}>{details?.preferences?.isMuted ? "Unmute notifications" : "Mute notifications"}</button>{details?.conversationType === "group" ? <button type="button" className="workspace-inline-action" onClick={() => runAndRefresh(() => exitGroup(selectedConversation.conversationId), true)}>Exit group</button> : null}{details?.conversationType === "group" && canManageMembers ? <button type="button" className="workspace-inline-action workspace-inline-action-danger" onClick={() => runAndRefresh(() => deleteGroup(selectedConversation.conversationId), true)}>Delete group</button> : null}{details?.conversationType === "community" && details?.createdByUserId !== currentUser?.id ? <button type="button" className="workspace-inline-action" onClick={() => runAndRefresh(() => leaveCommunity(selectedConversation.conversationId), true)}>Exit community</button> : null}{details?.conversationType === "community" && details?.createdByUserId === currentUser?.id ? <button type="button" className="workspace-inline-action workspace-inline-action-danger" onClick={() => handleDeleteCommunity?.()}>Delete community</button> : null}</div></article>
          </>
        ) : null}
      </div>
    </section>
  );
}

export default ChatProfilePanel;
