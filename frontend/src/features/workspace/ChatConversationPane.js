import React, { useEffect, useMemo, useRef, useState } from "react";

import { buildChatAuthenticatedUrl, buildChatFileUrl } from "./chatManagementApi";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏"];

function formatDate(value, options) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-GB", options);
  } catch {
    return "";
  }
}

function statusTicks(status) {
  if (status === "read") return "✓✓";
  if (status === "delivered") return "✓✓";
  return "✓";
}

function formatBubbleTime(value) {
  return formatDate(value, { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

function formatLastSeen(value) {
  if (!value) return "offline";
  return `last seen ${formatDate(value, { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}`;
}

function formatDayDivider(value) {
  if (!value) return "";

  const today = new Date();
  const current = new Date(value);
  if (Number.isNaN(current.getTime())) return "";

  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const currentStart = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const diff = Math.round((dayStart.getTime() - currentStart.getTime()) / 86400000);

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";

  return formatDate(value, {
    day: "2-digit",
    month: "short",
    year: current.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function buildConversationGroups(messages) {
  return messages.reduce((groups, message) => {
    const label = formatDayDivider(message.createdAt);
    const currentGroup = groups[groups.length - 1];

    if (!currentGroup || currentGroup.label !== label) {
      groups.push({ label, items: [message] });
      return groups;
    }

    currentGroup.items.push(message);
    return groups;
  }, []);
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

function isInteractiveTarget(target) {
  return Boolean(target.closest("a, button, input, textarea, label"));
}

function getMenuPosition(container, event, width, height = 220, anchorElement = null) {
  const bounds = container?.getBoundingClientRect();
  const scrollLeft = container?.scrollLeft || 0;
  const scrollTop = container?.scrollTop || 0;
  const anchorBounds = anchorElement?.getBoundingClientRect();
  const fallbackX = (event.clientX - (bounds?.left || 0)) + scrollLeft;
  const fallbackY = (event.clientY - (bounds?.top || 0)) + scrollTop;
  const preferredX = anchorBounds
    ? (anchorBounds.left - (bounds?.left || 0)) + scrollLeft + Math.min(anchorBounds.width || 0, 40)
    : fallbackX;
  const preferredY = anchorBounds
    ? (anchorBounds.top - (bounds?.top || 0)) + scrollTop + Math.min(anchorBounds.height || 0, 18)
    : fallbackY;
  const minX = scrollLeft + 12;
  const minY = scrollTop + 12;
  const maxX = Math.max(minX, scrollLeft + (bounds?.width || 0) - width - 12);
  const maxY = Math.max(minY, scrollTop + (bounds?.height || 0) - height - 12);

  return {
    x: Math.min(Math.max(minX, preferredX), maxX),
    y: Math.min(Math.max(minY, preferredY), maxY),
  };
}

function getAttachmentKind(message) {
  if (message.messageType === "image") return "image";
  if (message.messageType === "video") return "video";
  if (message.messageType === "voice") return "audio";
  if ((message.mimeType || "").toLowerCase().includes("pdf")) return "pdf";
  return "file";
}

function canPreviewAttachment(message) {
  return ["image", "video", "audio", "pdf"].includes(getAttachmentKind(message));
}

function ChatConversationPane({
  currentUser,
  selectedItem,
  selectedConversation,
  messages,
  hasMoreMessages,
  conversationStreamRef,
  selectedTyping,
  highlightedMessageId,
  editingMessageId,
  editingDraft,
  setEditingDraft,
  setEditingMessageId,
  replyToMessage,
  setReplyToMessage,
  selectedAttachment,
  setSelectedAttachment,
  attachmentPreviewUrl,
  messageDraft,
  handleDraftChange,
  handleSendMessage,
  handleDeleteMessage,
  handleSaveEdit,
  handleToggleReaction,
  handleToggleStar,
  handleTogglePin,
  isSending,
  loadOlderMessages,
  handleUpdateConversationBackground,
  handleClearConversationBackground,
  onOpenProfile,
  onForwardMessage,
}) {
  const groupedMessages = buildConversationGroups(messages || []);
  const messageIndex = useMemo(() => new Map((messages || []).map((message) => [message.id, message])), [messages]);
  const chatTitle = selectedItem?.title || "Select a chat";
  const chatPresence = selectedTyping
    ? "typing..."
    : selectedItem?.presenceStatus === "online"
      ? "online"
      : selectedItem?.lastSeenAt
        ? formatLastSeen(selectedItem.lastSeenAt)
        : selectedItem?.statusText || selectedItem?.subtitle || "Select a conversation";
  const attachmentAccept = "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";
  const streamRef = useRef(null);
  const wallpaperInputRef = useRef(null);
  const popupRef = useRef(null);
  const [messageMenu, setMessageMenu] = useState(null);
  const [backgroundMenu, setBackgroundMenu] = useState(null);
  const [messageInfo, setMessageInfo] = useState(null);
  const [attachmentViewer, setAttachmentViewer] = useState(null);

  const backgroundImageUrl = useMemo(() => buildChatAuthenticatedUrl(selectedItem?.backgroundUrl || ""), [selectedItem?.backgroundUrl]);
  const headerAvatarImage = useMemo(() => buildChatAuthenticatedUrl(selectedItem?.imageUrl || ""), [selectedItem?.imageUrl]);
  const streamBackgroundStyle = backgroundImageUrl ? { "--workspace-chat-custom-bg": `url("${backgroundImageUrl}")` } : undefined;
  const composerActionLabel = !messageDraft.trim() && !selectedAttachment ? "Voice message" : isSending ? "Sending" : "Send message";

  useEffect(() => {
    setMessageMenu(null);
    setBackgroundMenu(null);
    setMessageInfo(null);
    setAttachmentViewer(null);
  }, [selectedConversation]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const target = streamRef.current?.querySelector(`[data-chat-message-id="${highlightedMessageId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedMessageId, messages]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!popupRef.current?.contains(event.target)) {
        setMessageMenu(null);
        setBackgroundMenu(null);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const openMessageMenu = (event, message, anchorElement = null) => {
    event.preventDefault();
    event.stopPropagation();
    const position = getMenuPosition(streamRef.current, event, 220, 340, anchorElement);
    setBackgroundMenu(null);
    setMessageMenu({ message, x: position.x, y: position.y });
  };

  const openBackgroundMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const position = getMenuPosition(streamRef.current, event, 200, 140);
    setMessageMenu(null);
    setBackgroundMenu({ x: position.x, y: position.y });
  };

  const handleStreamContextMenu = (event) => {
    const messageElement = event.target.closest("[data-chat-message-id]");
    if (messageElement) {
      const message = messageIndex.get(messageElement.dataset.chatMessageId);
      if (message) {
        openMessageMenu(event, message, messageElement);
        return;
      }
    }

    if (!isInteractiveTarget(event.target)) {
      openBackgroundMenu(event);
    }
  };

  const handleCopyMessage = async (message) => {
    const textToCopy = [message.body, message.fileName].filter(Boolean).join("\n").trim();
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
    }

    setMessageMenu(null);
  };

  const handleWallpaperUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleUpdateConversationBackground?.(file);
    setBackgroundMenu(null);
    event.target.value = "";
  };

  const handleOpenAttachment = (message) => {
    if (!message?.fileUrl) return;
    const fileUrl = buildChatFileUrl(message.id);
    if (canPreviewAttachment(message)) {
      setAttachmentViewer({
        id: message.id,
        url: fileUrl,
        fileName: message.fileName || "Attachment",
        kind: getAttachmentKind(message),
        mimeType: message.mimeType || "",
      });
      setMessageMenu(null);
      return;
    }
    window.open(fileUrl, "_blank", "noopener,noreferrer");
    setMessageMenu(null);
  };

  const handleDownloadAttachment = (message) => {
    if (!message?.id) return;
    const link = document.createElement("a");
    link.href = buildChatFileUrl(message.id);
    link.download = message.fileName || "attachment";
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setMessageMenu(null);
  };

  return (
    <section className="workspace-hub-card workspace-chat-conversation-card workspace-chat-whatsapp-shell">
      <div className="workspace-chat-mobile-header">
        <button type="button" className="workspace-chat-contact-row workspace-chat-contact-trigger workspace-chat-header-trigger" onClick={() => onOpenProfile?.()}>
          <div className="workspace-chat-avatar workspace-chat-avatar-large">
            {headerAvatarImage ? <img src={headerAvatarImage} alt={chatTitle} className="workspace-chat-avatar-image" /> : getAvatarLabel(chatTitle)}
          </div>
          <div className="workspace-chat-contact-copy">
            <strong title={chatTitle}>{chatTitle}</strong>
            <span title={chatPresence}>{chatPresence}</span>
          </div>
        </button>

        <div className="workspace-chat-header-actions">
          {selectedItem?.isMuted || selectedItem?.preferences?.isMuted ? <span className="workspace-chat-header-badge" title="Muted">&#128263;</span> : null}
          <button type="button" className="workspace-chat-icon-button" aria-label="Voice call">
            <span aria-hidden="true">&#9742;</span>
          </button>
          <button type="button" className="workspace-chat-icon-button" aria-label="Video call">
            <span aria-hidden="true">&#9654;</span>
          </button>
        </div>
      </div>

      <div
        ref={(node) => {
          streamRef.current = node;
          if (typeof conversationStreamRef === "function") conversationStreamRef(node);
          else if (conversationStreamRef) conversationStreamRef.current = node;
        }}
        className={`workspace-chat-conversation-stream ${backgroundImageUrl ? "has-custom-background" : ""}`}
        style={streamBackgroundStyle}
        onContextMenu={handleStreamContextMenu}
      >
        {hasMoreMessages ? (
          <button type="button" className="hero-button hero-button-secondary workspace-chat-load-more" onClick={loadOlderMessages}>
            Load older messages
          </button>
        ) : null}

        {selectedConversation ? (
          groupedMessages.map((group, groupIndex) => (
            <div key={`${group.label || "messages"}-${groupIndex}`} className="workspace-chat-day-group">
              {group.label ? (
                <div className="workspace-chat-day-divider">
                  <span>{group.label}</span>
                </div>
              ) : null}

              {group.items.map((message) => {
                const mine = message.senderId === currentUser?.id;
                const isImage = message.messageType === "image";
                const isVideo = message.messageType === "video";
                const isVoice = message.messageType === "voice";
                const hasPreview = canPreviewAttachment(message);
                const fileUrl = message.fileUrl ? buildChatFileUrl(message.id) : "";

                return (
                  <article
                    key={message.id}
                    data-chat-message-id={message.id}
                    className={`workspace-chat-bubble ${mine ? "is-user" : "is-assistant"} workspace-direct-message ${highlightedMessageId === message.id ? "is-highlighted" : ""}`}
                    onContextMenu={(event) => openMessageMenu(event, message, event.currentTarget)}
                  >
                    {!mine && selectedConversation.conversationType !== "direct" ? (
                      <strong className="workspace-chat-sender-line">{message.senderName}</strong>
                    ) : null}

                    {message.replyPreview ? (
                      <div className="workspace-chat-reply-preview">
                        <strong>{message.replyPreview.senderName}</strong>
                        <p>{message.replyPreview.body}</p>
                      </div>
                    ) : null}

                    {editingMessageId === message.id ? (
                      <div className="workspace-chat-edit-shell">
                        <textarea
                          className="question-input workspace-chat-composer-input workspace-chat-edit-input"
                          rows={3}
                          value={editingDraft}
                          onChange={(event) => setEditingDraft(event.target.value)}
                        />
                        <div className="workspace-chat-inline-actions">
                          <button type="button" className="inline-text-button" onClick={() => handleSaveEdit(message.id)}>
                            Save
                          </button>
                          <button
                            type="button"
                            className="inline-text-button"
                            onClick={() => {
                              setEditingMessageId("");
                              setEditingDraft("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message.fileUrl ? (
                          isImage ? (
                            <button
                              type="button"
                              className="workspace-chat-media-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenAttachment(message);
                              }}
                            >
                              <img src={fileUrl} alt={message.fileName || "attachment"} className="workspace-chat-image-preview" />
                            </button>
                          ) : isVideo ? (
                            <button
                              type="button"
                              className="workspace-chat-media-link workspace-chat-video-link"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenAttachment(message);
                              }}
                            >
                              <video className="workspace-chat-image-preview workspace-chat-video-preview" preload="metadata">
                                <source src={fileUrl} type={message.mimeType || "video/mp4"} />
                              </video>
                            </button>
                          ) : isVoice ? (
                            <audio className="workspace-chat-audio-preview" controls preload="metadata">
                              <source src={fileUrl} type={message.mimeType || "audio/mpeg"} />
                            </audio>
                          ) : (
                            <button
                              type="button"
                              className="workspace-chat-file-chip"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenAttachment(message);
                              }}
                            >
                              {hasPreview ? `View ${message.fileName || "file"}` : (message.fileName || "Open file")}
                            </button>
                          )
                        ) : null}
                        {message.body ? <p className="workspace-chat-bubble-copy">{message.body}</p> : null}
                      </>
                    )}

                    <div className="workspace-chat-bubble-foot">
                      <span>{formatBubbleTime(message.createdAt)}{message.editedAt ? " edited" : ""}</span>
                      {mine ? <span className={`workspace-chat-status-ticks ${message.status === "read" ? "is-read" : ""}`}>{statusTicks(message.status)}</span> : null}
                    </div>
                    {message.reactions?.length ? (
                      <div className="workspace-chat-reaction-row">
                        {message.reactions.map((reaction) => (
                          <button
                            key={`${message.id}-${reaction.emoji}`}
                            type="button"
                            className={`workspace-chat-reaction-chip ${reaction.reactedByCurrentUser ? "is-active" : ""}`}
                            onClick={() => handleToggleReaction(message.id, reaction.emoji)}
                          >
                            {reaction.emoji} {reaction.count}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ))
        ) : (
          <p className="status-item status-info">Select a chat, group, or community to start messaging.</p>
        )}

        {selectedTyping ? <p className="workspace-chat-typing-indicator">typing...</p> : null}

        {messageMenu ? (
          <div ref={popupRef} className="workspace-chat-popup-menu" style={{ left: `${messageMenu.x}px`, top: `${messageMenu.y}px` }}>
            <div className="workspace-chat-reaction-row workspace-chat-popup-reactions">
              {REACTION_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" className="workspace-chat-reaction-chip" onClick={() => { handleToggleReaction(messageMenu.message.id, emoji); setMessageMenu(null); }}>
                  {emoji}
                </button>
              ))}
            </div>
            <button type="button" className="workspace-chat-popup-item" onClick={() => { setMessageInfo(messageMenu.message); setMessageMenu(null); }}>Message info</button>
            {messageMenu.message.fileUrl ? <button type="button" className="workspace-chat-popup-item" onClick={() => handleOpenAttachment(messageMenu.message)}>View</button> : null}
            {messageMenu.message.fileUrl ? <button type="button" className="workspace-chat-popup-item" onClick={() => handleDownloadAttachment(messageMenu.message)}>Download</button> : null}
            <button type="button" className="workspace-chat-popup-item" onClick={() => { setReplyToMessage(messageMenu.message); setMessageMenu(null); }}>Reply</button>
            <button type="button" className="workspace-chat-popup-item" onClick={() => { onForwardMessage?.(messageMenu.message); setMessageMenu(null); }}>Forward</button>
            <button type="button" className="workspace-chat-popup-item" onClick={() => { handleToggleStar(messageMenu.message.id); setMessageMenu(null); }}>{messageMenu.message.isStarred ? "Unstar" : "Star"}</button>
            <button type="button" className="workspace-chat-popup-item" onClick={() => { handleTogglePin(messageMenu.message.id); setMessageMenu(null); }}>{messageMenu.message.isPinned ? "Unpin" : "Pin"}</button>
            <button type="button" className="workspace-chat-popup-item" onClick={() => handleCopyMessage(messageMenu.message)}>Copy</button>
            {messageMenu.message.canEdit ? (
              <button type="button" className="workspace-chat-popup-item" onClick={() => { setEditingMessageId(messageMenu.message.id); setEditingDraft(messageMenu.message.body || ""); setMessageMenu(null); }}>
                Edit
              </button>
            ) : null}
            <button type="button" className="workspace-chat-popup-item workspace-chat-popup-item-danger" onClick={() => { handleDeleteMessage(messageMenu.message.id, "me"); setMessageMenu(null); }}>Delete for me</button>
            {messageMenu.message.canDeleteForEveryone ? <button type="button" className="workspace-chat-popup-item workspace-chat-popup-item-danger" onClick={() => { handleDeleteMessage(messageMenu.message.id, "everyone"); setMessageMenu(null); }}>Delete for everyone</button> : null}
          </div>
        ) : null}

        {backgroundMenu ? (
          <div ref={popupRef} className="workspace-chat-popup-menu workspace-chat-background-menu" style={{ left: `${backgroundMenu.x}px`, top: `${backgroundMenu.y}px` }}>
            <button type="button" className="workspace-chat-popup-item" onClick={() => wallpaperInputRef.current?.click()}>Change background</button>
            <button type="button" className="workspace-chat-popup-item" onClick={() => { handleClearConversationBackground?.(); setBackgroundMenu(null); }}>Reset background</button>
          </div>
        ) : null}
      </div>

      {attachmentViewer ? (
        <div className="workspace-chat-viewer-backdrop" onClick={() => setAttachmentViewer(null)}>
          <div className="workspace-chat-viewer-modal" onClick={(event) => event.stopPropagation()}>
            <div className="workspace-chat-viewer-header">
              <strong>{attachmentViewer.fileName}</strong>
              <div className="workspace-chat-viewer-actions">
                <button type="button" className="inline-text-button" onClick={() => handleDownloadAttachment({ id: attachmentViewer.id, fileName: attachmentViewer.fileName })}>Download</button>
                <button type="button" className="inline-text-button" onClick={() => setAttachmentViewer(null)}>Close</button>
              </div>
            </div>
            <div className="workspace-chat-viewer-body">
              {attachmentViewer.kind === "image" ? <img src={attachmentViewer.url} alt={attachmentViewer.fileName} className="workspace-chat-viewer-image" /> : null}
              {attachmentViewer.kind === "video" ? <video className="workspace-chat-viewer-media" controls autoPlay preload="metadata"><source src={attachmentViewer.url} type={attachmentViewer.mimeType || "video/mp4"} /></video> : null}
              {attachmentViewer.kind === "audio" ? <audio className="workspace-chat-viewer-audio" controls autoPlay preload="metadata"><source src={attachmentViewer.url} type={attachmentViewer.mimeType || "audio/mpeg"} /></audio> : null}
              {attachmentViewer.kind === "pdf" ? <iframe title={attachmentViewer.fileName} src={attachmentViewer.url} className="workspace-chat-viewer-frame" /> : null}
            </div>
          </div>
        </div>
      ) : null}

      <input ref={wallpaperInputRef} type="file" accept="image/*" className="workspace-chat-hidden-input" onChange={handleWallpaperUpload} />

      {replyToMessage ? (
        <div className="workspace-chat-compose-preview">
          <span>Replying to {replyToMessage.senderName}</span>
          <strong>{replyToMessage.body || replyToMessage.fileName || "Attachment"}</strong>
          <button type="button" className="inline-text-button" onClick={() => setReplyToMessage(null)}>Clear</button>
        </div>
      ) : null}

      {messageInfo ? (
        <div className="workspace-chat-compose-preview">
          <span>{messageInfo.senderName || (messageInfo.senderId === currentUser?.id ? "You" : "Message")}</span>
          <strong>{formatDate(messageInfo.createdAt, { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}{messageInfo.status ? ` · ${messageInfo.status}` : ""}</strong>
          <button type="button" className="inline-text-button" onClick={() => setMessageInfo(null)}>Clear</button>
        </div>
      ) : null}

      {selectedAttachment ? (
        <div className="workspace-chat-compose-preview">
          <span>Attachment ready</span>
          <strong>{selectedAttachment.name}</strong>
          <button type="button" className="inline-text-button" onClick={() => setSelectedAttachment(null)}>Remove</button>
        </div>
      ) : null}

      {attachmentPreviewUrl ? <img src={attachmentPreviewUrl} alt="attachment preview" className="workspace-chat-image-preview workspace-chat-compose-image" /> : null}

      <div className="workspace-chat-composer workspace-chat-mobile-composer">
        <div className="workspace-chat-input-shell">
          <button type="button" className="workspace-chat-emoji-trigger" aria-label="Emoji picker"><span aria-hidden="true">&#9786;</span></button>
          <textarea className="question-input workspace-chat-composer-input workspace-chat-mobile-input" rows={1} value={messageDraft} onChange={(event) => handleDraftChange(event.target.value)} placeholder={selectedItem ? `Message ${selectedItem.title}` : "Select a conversation to message"} disabled={!selectedConversation} />
          <label className="workspace-chat-attach-button" aria-label="Attach file"><span aria-hidden="true">&#128206;</span><input type="file" accept={attachmentAccept} onChange={(event) => setSelectedAttachment(event.target.files?.[0] || null)} /></label>
          <button type="button" className="workspace-chat-emoji-button workspace-chat-inline-icon" aria-label="Payments"><span aria-hidden="true">&#8377;</span></button>
          <button type="button" className="workspace-chat-camera-button" aria-label="Camera"><span aria-hidden="true">&#128247;</span></button>
        </div>

        <button type="button" className="workspace-chat-send-fab" onClick={handleSendMessage} disabled={!selectedConversation || isSending} aria-label={composerActionLabel}>
          <span aria-hidden="true">{!messageDraft.trim() && !selectedAttachment ? "\uD83C\uDFA4" : isSending ? "..." : "\u27A4"}</span>
        </button>
      </div>
    </section>
  );
}

export default ChatConversationPane;
