import React, { useEffect, useMemo, useRef, useState } from "react";

import { changePassword, fetchSettingsCategory, saveSettingsCategory, updateProfile } from "../auth/authApi";
import { resetFirebaseRecaptcha, sendFirebaseOtp, verifyFirebaseOtp } from "../../shared/firebase/phoneAuth";
import { buildChatAuthenticatedUrl, uploadChatProfilePhoto } from "./chatManagementApi";

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

function ChatProfilePanel({
  currentUser,
  selectedConversation,
  details,
  onClose,
  setPanelError,
  handleUpdateConversationPreference,
  handleClearConversation,
  handleDeleteConversationMedia,
  handleChatProfileUpdated,
  refreshSelectedConversation,
  handleRemoveFriend,
}) {
  const [activeSettingsTab, setActiveSettingsTab] = useState("account");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState("");
  const [accountForm, setAccountForm] = useState({ fullName: "", bio: "", image: null });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [otpState, setOtpState] = useState({ confirmation: null, code: "", sending: false, verifying: false });
  const otpRecaptchaId = useRef(`chat-profile-otp-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    setAccountForm({
      fullName: currentUser?.fullName || currentUser?.name || details?.title || "",
      bio: currentUser?.bio || details?.bio || "",
      image: null,
    });
  }, [currentUser?.bio, currentUser?.fullName, currentUser?.name, details?.bio, details?.title]);

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

  const profileImageUrl = useMemo(
    () => buildChatAuthenticatedUrl(details?.imageUrl || currentUser?.profileImageUrl || ""),
    [details?.imageUrl, currentUser?.profileImageUrl]
  );

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
      if (accountForm.image) {
        await uploadChatProfilePhoto(accountForm.image);
      }
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

  const isDirect = details?.conversationType === "direct";
  const contactEmail = isDirect ? "Visible only when shared in this chat." : currentUser?.email || "Available in account profile";
  const contactPhone = isDirect ? "Visible only when shared in this chat." : currentUser?.mobile || "Not added";

  return (
    <section className="workspace-hub-card workspace-chat-conversation-card workspace-chat-profile-panel">
      <div className="workspace-chat-profile-header">
        <button type="button" className="workspace-chat-icon-button" aria-label="Back to conversation" onClick={onClose}>
          <span aria-hidden="true">&#8592;</span>
        </button>
        <div className="workspace-chat-profile-header-copy">
          <strong>{details?.title || "Profile"}</strong>
          <span>Profile</span>
        </div>
      </div>

      <div className="workspace-chat-profile-scroll">
        <div className="workspace-chat-profile-hero">
          <div className="workspace-chat-avatar workspace-chat-avatar-xl">
            {profileImageUrl ? <img src={profileImageUrl} alt={details?.title || "Profile"} className="workspace-chat-avatar-image" /> : details?.avatarLabel || "P"}
          </div>
          <h3>{details?.title || currentUser?.fullName || "Profile"}</h3>
          <p>{details?.subtitle || "@" + (currentUser?.username || "workspace-user")}</p>
          <span>{details?.bio || "No bio available yet."}</span>
        </div>

        <div className="workspace-chat-profile-grid">
          <article className="workspace-chat-settings-card">
            <div className="workspace-chat-section-heading">
              <div className="workspace-chat-section-heading-main">
                <span className="workspace-chat-section-icon" aria-hidden="true">PR</span>
                <div>
                  <span className="workspace-hub-eyebrow">Profile</span>
                  <h4>Contact details</h4>
                </div>
              </div>
            </div>
            <div className="workspace-chat-profile-detail-list">
              <div className="workspace-chat-profile-detail-item">
                <span>Name</span>
                <strong>{details?.title || currentUser?.fullName || "Not available"}</strong>
              </div>
              <div className="workspace-chat-profile-detail-item">
                <span>Username</span>
                <strong>{details?.subtitle || `@${currentUser?.username || "workspace-user"}`}</strong>
              </div>
              <div className="workspace-chat-profile-detail-item">
                <span>About</span>
                <strong>{details?.bio || currentUser?.bio || "No bio available"}</strong>
              </div>
              <div className="workspace-chat-profile-detail-item">
                <span>Email</span>
                <strong>{contactEmail}</strong>
              </div>
              <div className="workspace-chat-profile-detail-item">
                <span>Phone</span>
                <strong>{contactPhone}</strong>
              </div>
            </div>
          </article>

          <article className="workspace-chat-settings-card">
            <div className="workspace-chat-section-heading">
              <div className="workspace-chat-section-heading-main">
                <span className="workspace-chat-section-icon" aria-hidden="true">CT</span>
                <div>
                  <span className="workspace-hub-eyebrow">Conversation</span>
                  <h4>Actions & settings</h4>
                </div>
              </div>
            </div>
            <div className="workspace-chat-chip-row">
              <button type="button" className={`workspace-inline-action ${details?.preferences?.isMuted ? "is-active" : ""}`} onClick={() => handleUpdateConversationPreference({ isMuted: !details?.preferences?.isMuted })}>{details?.preferences?.isMuted ? "Unmute" : "Mute"}</button>
              <button type="button" className={`workspace-inline-action ${details?.preferences?.isPinned ? "is-active" : ""}`} onClick={() => handleUpdateConversationPreference({ isPinned: !details?.preferences?.isPinned })}>{details?.preferences?.isPinned ? "Unpin" : "Pin"}</button>
              <button type="button" className={`workspace-inline-action ${details?.preferences?.isArchived ? "is-active" : ""}`} onClick={() => handleUpdateConversationPreference({ isArchived: !details?.preferences?.isArchived })}>{details?.preferences?.isArchived ? "Unarchive" : "Archive"}</button>
              {isDirect ? <button type="button" className={`workspace-inline-action ${details?.preferences?.isBlocked ? "is-active" : ""}`} onClick={() => handleUpdateConversationPreference({ isBlocked: !details?.preferences?.isBlocked })}>{details?.preferences?.isBlocked ? "Unblock" : "Block"}</button> : null}
            </div>
            <label className="workspace-form-stack">
              <span>Disappearing messages</span>
              <select className="workspace-input workspace-command-search" value={details?.preferences?.disappearingMode || "off"} onChange={(event) => handleUpdateConversationPreference({ disappearingMode: event.target.value })}>
                <option value="off">Off</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="90d">90 days</option>
              </select>
            </label>
            <div className="workspace-chat-inline-actions">
              {isDirect ? (
                <button type="button" className="inline-text-button" onClick={() => {
                  if (window.confirm(`Remove ${details?.title} from friends and delete this direct chat?`)) {
                    handleRemoveFriend?.();
                    onClose?.();
                  }
                }}>
                  Remove friend
                </button>
              ) : null}
              {selectedConversation ? <button type="button" className="inline-text-button" onClick={handleClearConversation}>Clear chat</button> : null}
              {selectedConversation ? <button type="button" className="inline-text-button" onClick={handleDeleteConversationMedia}>Delete media</button> : null}
            </div>
          </article>
        </div>

        <article className="workspace-chat-settings-card">
          <div className="workspace-chat-section-heading">
            <div className="workspace-chat-section-heading-main">
              <span className="workspace-chat-section-icon" aria-hidden="true">ST</span>
              <div>
                <span className="workspace-hub-eyebrow">Settings</span>
                <h4>Profile & privacy</h4>
              </div>
            </div>
          </div>
          <div className="workspace-chat-tab-row workspace-chat-profile-tab-row">
            {SETTINGS_TABS.map((tab) => (
              <button key={tab} type="button" className={`workspace-toggle-button ${activeSettingsTab === tab ? "is-active" : ""}`} onClick={() => setActiveSettingsTab(tab)}>
                {labelize(tab)}
              </button>
            ))}
          </div>
          {settingsLoading ? <p className="status-item status-info">Loading chat settings...</p> : null}
          {activeSettingsTab === "account" ? <div className="workspace-form-stack"><input className="workspace-input workspace-command-search" value={accountForm.fullName} onChange={(event) => setAccountForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Display name" /><textarea className="question-input workspace-chat-composer-input" rows={3} value={accountForm.bio} onChange={(event) => setAccountForm((current) => ({ ...current, bio: event.target.value }))} placeholder="Bio" /><label className="workspace-chat-attach-button">Profile photo<input type="file" accept="image/*" onChange={(event) => setAccountForm((current) => ({ ...current, image: event.target.files?.[0] || null }))} /></label><button type="button" className="hero-button hero-button-secondary" onClick={saveAccount} disabled={settingsSaving === "account"}>Save account</button></div> : null}
          {activeSettingsTab === "security" ? <div className="workspace-form-stack"><input className="workspace-input workspace-command-search" type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} placeholder="Current password" /><input className="workspace-input workspace-command-search" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} placeholder="New password" /><input className="workspace-input workspace-command-search" type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} placeholder="Confirm new password" /><button type="button" className="hero-button hero-button-secondary" onClick={savePassword} disabled={settingsSaving === "security"}>Change password</button><select className="workspace-input workspace-command-search" value={settings.security.otpChannel} onChange={(event) => setSettings((current) => ({ ...current, security: { ...current.security, otpChannel: event.target.value, twoStepEnabled: current.security.twoStepEnabled } }))}><option value="sms">SMS OTP</option><option value="email">Email OTP</option></select><div id={otpRecaptchaId.current} /><div className="workspace-chat-inline-actions"><button type="button" className="inline-text-button" onClick={() => saveCategory("chat-security", { ...settings.security, twoStepEnabled: false }, "security")}>Disable 2-step</button><button type="button" className="inline-text-button" onClick={sendOtp} disabled={otpState.sending}>{otpState.sending ? "Sending..." : "Send OTP"}</button></div><input className="workspace-input workspace-command-search" value={otpState.code} onChange={(event) => setOtpState((current) => ({ ...current, code: event.target.value }))} placeholder="Enter OTP" /><button type="button" className="hero-button hero-button-secondary" onClick={verifyOtp} disabled={otpState.verifying}>{otpState.verifying ? "Verifying..." : "Verify & enable"}</button></div> : null}
          {activeSettingsTab === "notifications" ? <div className="workspace-form-stack">{Object.entries(settings.notifications).map(([key, value]) => <label key={key} className="workspace-chat-setting-row"><span>{labelize(key)}</span><input type="checkbox" checked={Boolean(value)} onChange={(event) => setSettings((current) => ({ ...current, notifications: { ...current.notifications, [key]: event.target.checked } }))} /></label>)}<button type="button" className="hero-button hero-button-secondary" onClick={() => saveCategory("chat-notifications", settings.notifications, "notifications")} disabled={settingsSaving === "chat-notifications"}>Save notifications</button></div> : null}
          {activeSettingsTab === "privacy" ? <div className="workspace-form-stack"><select className="workspace-input workspace-command-search" value={settings.privacy.lastSeenVisibility} onChange={(event) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, lastSeenVisibility: event.target.value } }))}><option value="everyone">Last seen: everyone</option><option value="contacts">Last seen: contacts</option><option value="nobody">Last seen: nobody</option></select><select className="workspace-input workspace-command-search" value={settings.privacy.profileVisibility} onChange={(event) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, profileVisibility: event.target.value } }))}><option value="everyone">Profile: everyone</option><option value="contacts">Profile: contacts</option><option value="nobody">Profile: nobody</option></select><label className="workspace-chat-setting-row"><span>Read receipts</span><input type="checkbox" checked={Boolean(settings.privacy.readReceiptsEnabled)} onChange={(event) => setSettings((current) => ({ ...current, privacy: { ...current.privacy, readReceiptsEnabled: event.target.checked } }))} /></label><button type="button" className="hero-button hero-button-secondary" onClick={() => saveCategory("chat-privacy", settings.privacy, "privacy")} disabled={settingsSaving === "chat-privacy"}>Save privacy</button></div> : null}
          {activeSettingsTab === "chat" ? <div className="workspace-form-stack">{Object.entries(settings.chat).map(([key, value]) => <label key={key} className="workspace-chat-setting-row"><span>{labelize(key)}</span><input type="checkbox" checked={Boolean(value)} onChange={(event) => setSettings((current) => ({ ...current, chat: { ...current.chat, [key]: event.target.checked } }))} /></label>)}<button type="button" className="hero-button hero-button-secondary" onClick={() => saveCategory("chat-preferences", settings.chat, "chat")} disabled={settingsSaving === "chat-preferences"}>Save chat settings</button></div> : null}
          {activeSettingsTab === "storage" ? <div className="workspace-form-stack"><div className="workspace-chat-storage-grid"><article className="workspace-chat-member-card"><strong>{formatBytes(details?.storage?.totalBytes)}</strong><p>Total storage</p></article><article className="workspace-chat-member-card"><strong>{details?.storage?.totalFiles || 0}</strong><p>Total files</p></article><article className="workspace-chat-member-card"><strong>{details?.storage?.imageCount || 0}</strong><p>Images</p></article><article className="workspace-chat-member-card"><strong>{details?.storage?.videoCount || 0}</strong><p>Videos</p></article><article className="workspace-chat-member-card"><strong>{details?.storage?.voiceCount || 0}</strong><p>Voice</p></article><article className="workspace-chat-member-card"><strong>{details?.storage?.fileCount || 0}</strong><p>Files</p></article></div></div> : null}
        </article>
      </div>
    </section>
  );
}

export default ChatProfilePanel;
