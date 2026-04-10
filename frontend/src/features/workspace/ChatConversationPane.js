import React, { useEffect, useMemo, useRef, useState } from "react";

import { buildChatFileUrl } from "./chatManagementApi";

function formatDate(value, options) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-GB", options);
  } catch {
    return "";
  }
}

function statusTicks(status) {
  if (status === "read") return "\u2713\u2713";
  if (status === "delivered") return "\u2713\u2713";
  return "\u2713";
}

function formatBubbleTime(value) {
  return formatDate(value, { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
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

function getBackgroundStorageKey(conversation) {
  if (!conversation?.conversationType || !conversation?.conversationId) return "";
  return `genai_chat_bg_${conversation.conversationType}_${conversation.conversationId}`;
}

function isInteractiveTarget(target) {
  return Boolean(target.closest("a, button, input, textarea, label"));
}

function getMenuPosition(bounds, event, width) {
  const offsetX = event.clientX - (bounds?.left || 0);
  const offsetY = event.clientY - (bounds?.top || 0);
  const maxX = Math.max(12, (bounds?.width || 0) - width - 12);
  const maxY = Math.max(12, (bounds?.height || 0) - 220);

  return {
    x: Math.min(Math.max(12, offsetX), maxX),
    y: Math.min(Math.max(12, offsetY), maxY),
  };
}

function ChatConversationPane({
  currentUser,
  selectedItem,
  selectedConversation,
  messages,
  hasMoreMessages,
  conversationStreamRef,
  selectedTyping,
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
  isSending,
  loadOlderMessages,
}) {
  const groupedMessages = buildConversationGroups(messages || []);
  const chatTitle = selectedItem?.title || "Select a chat";
  const chatPresence = selectedItem?.subtitle || selectedItem?.statusText || "Tap a conversation to start chatting";
  const attachmentAccept = "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";
  const streamRef = useRef(null);
  const wallpaperInputRef = useRef(null);
  const popupRef = useRef(null);
  const [messageMenu, setMessageMenu] = useState(null);
  const [backgroundMenu, setBackgroundMenu] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState("");
  const [messageInfo, setMessageInfo] = useState(null);

  const backgroundStorageKey = useMemo(() => getBackgroundStorageKey(selectedConversation), [selectedConversation]);
  const streamBackgroundStyle = backgroundImage ? { "--workspace-chat-custom-bg": `url(${backgroundImage})` } : undefined;
  const composerActionLabel = !messageDraft.trim() && !selectedAttachment ? "Voice message" : isSending ? "Sending" : "Send message";

  useEffect(() => {
    setMessageMenu(null);
    setBackgroundMenu(null);
    setMessageInfo(null);
  }, [selectedConversation]);

  useEffect(() => {
    if (!backgroundStorageKey) {
      setBackgroundImage("");
      return;
    }

    try {
      setBackgroundImage(window.localStorage.getItem(backgroundStorageKey) || "");
    } catch {
      setBackgroundImage("");
    }
  }, [backgroundStorageKey]);

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

  const persistBackground = (nextBackground) => {
    setBackgroundImage(nextBackground);
    if (!backgroundStorageKey) return;

    try {
      if (nextBackground) window.localStorage.setItem(backgroundStorageKey, nextBackground);
      else window.localStorage.removeItem(backgroundStorageKey);
    } catch {
      // Ignore storage errors.
    }
  };

  const openMessageMenu = (event, message) => {
    event.preventDefault();
    event.stopPropagation();
    if (isInteractiveTarget(event.target)) return;
    const bounds = streamRef.current?.getBoundingClientRect();
    const position = getMenuPosition(bounds, event, 220);

    setBackgroundMenu(null);
    setMessageMenu({
      message,
      x: position.x,
      y: position.y,
    });
  };

  const openBackgroundMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.target.closest(".workspace-direct-message")) return;

    const bounds = streamRef.current?.getBoundingClientRect();
    const position = getMenuPosition(bounds, event, 200);
    setMessageMenu(null);
    setBackgroundMenu({
      x: position.x,
      y: position.y,
    });
  };

  const handleCopyMessage = async (message) => {
    const textToCopy = [message.body, message.fileName].filter(Boolean).join("\n").trim();
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      // Ignore clipboard errors.
    }

    setMessageMenu(null);
  };

  const handleWallpaperUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      persistBackground(typeof reader.result === "string" ? reader.result : "");
      setBackgroundMenu(null);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <section className="workspace-hub-card workspace-chat-conversation-card workspace-chat-whatsapp-shell">
      <div className="workspace-chat-mobile-header">
        <button type="button" className="workspace-chat-icon-button" aria-label="Back">
          <span aria-hidden="true">&#8592;</span>
        </button>

        <div className="workspace-chat-contact-row">
          <div className="workspace-chat-avatar workspace-chat-avatar-large">{getAvatarLabel(chatTitle)}</div>
          <div className="workspace-chat-contact-copy">
            <strong>{chatTitle}</strong>
            <span>{chatPresence}</span>
          </div>
        </div>

        <div className="workspace-chat-header-actions">
          <button type="button" className="workspace-chat-icon-button" aria-label="Video call">
            <span aria-hidden="true">&#9633;</span>
          </button>
          <button type="button" className="workspace-chat-icon-button" aria-label="Voice call">
            <span aria-hidden="true">&#9742;</span>
          </button>
          <button type="button" className="workspace-chat-icon-button" aria-label="More options">
            <span aria-hidden="true">&#8942;</span>
          </button>
        </div>
      </div>

      <div
        ref={(node) => {
          streamRef.current = node;
          if (typeof conversationStreamRef === "function") conversationStreamRef(node);
          else if (conversationStreamRef) conversationStreamRef.current = node;
        }}
        className="workspace-chat-conversation-stream"
        style={streamBackgroundStyle}
        onContextMenu={openBackgroundMenu}
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

                return (
                  <article
                    key={message.id}
                    className={`workspace-chat-bubble ${mine ? "is-user" : "is-assistant"} workspace-direct-message`}
                    onContextMenu={(event) => openMessageMenu(event, message)}
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
                            <a
                              href={buildChatFileUrl(message.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="workspace-chat-media-link"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <img src={buildChatFileUrl(message.id)} alt={message.fileName || "attachment"} className="workspace-chat-image-preview" />
                            </a>
                          ) : (
                            <a
                              href={buildChatFileUrl(message.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="workspace-chat-file-chip"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {message.fileName || "Download file"}
                            </a>
                          )
                        ) : null}
                        {message.body ? <p className="workspace-chat-bubble-copy">{message.body}</p> : null}
                      </>
                    )}

                    <div className="workspace-chat-bubble-foot">
                      <span>{formatBubbleTime(message.createdAt)}{message.editedAt ? " edited" : ""}</span>
                      {mine ? <span>{statusTicks(message.status)}</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ))
        ) : (
          <p className="status-item status-info">Select a chat, group, or community to start messaging.</p>
        )}

        {selectedTyping ? <p className="status-item status-info">Someone is typing...</p> : null}

        {messageMenu ? (
          <div
            ref={popupRef}
            className="workspace-chat-popup-menu"
            style={{ left: `${messageMenu.x}px`, top: `${messageMenu.y}px` }}
          >
            <button type="button" className="workspace-chat-popup-item" onClick={() => { setMessageInfo(messageMenu.message); setMessageMenu(null); }}>
              Message info
            </button>
            <button type="button" className="workspace-chat-popup-item" onClick={() => { setReplyToMessage(messageMenu.message); setMessageMenu(null); }}>
              Reply
            </button>
            <button type="button" className="workspace-chat-popup-item" onClick={() => handleCopyMessage(messageMenu.message)}>
              Copy
            </button>
            {messageMenu.message.canEdit ? (
              <button
                type="button"
                className="workspace-chat-popup-item"
                onClick={() => {
                  setEditingMessageId(messageMenu.message.id);
                  setEditingDraft(messageMenu.message.body || "");
                  setMessageMenu(null);
                }}
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              className="workspace-chat-popup-item workspace-chat-popup-item-danger"
              onClick={() => {
                handleDeleteMessage(messageMenu.message.id, "me");
                setMessageMenu(null);
              }}
            >
              Delete for me
            </button>
            {messageMenu.message.canDeleteForEveryone ? (
              <button
                type="button"
                className="workspace-chat-popup-item workspace-chat-popup-item-danger"
                onClick={() => {
                  handleDeleteMessage(messageMenu.message.id, "everyone");
                  setMessageMenu(null);
                }}
              >
                Delete for everyone
              </button>
            ) : null}
          </div>
        ) : null}

        {backgroundMenu ? (
          <div
            ref={popupRef}
            className="workspace-chat-popup-menu workspace-chat-background-menu"
            style={{ left: `${backgroundMenu.x}px`, top: `${backgroundMenu.y}px` }}
          >
            <button type="button" className="workspace-chat-popup-item" onClick={() => wallpaperInputRef.current?.click()}>
              Change background
            </button>
            <button
              type="button"
              className="workspace-chat-popup-item"
              onClick={() => {
                persistBackground("");
                setBackgroundMenu(null);
              }}
            >
              Reset background
            </button>
          </div>
        ) : null}
      </div>

      <input ref={wallpaperInputRef} type="file" accept="image/*" className="workspace-chat-hidden-input" onChange={handleWallpaperUpload} />

      {replyToMessage ? (
        <div className="workspace-chat-compose-preview">
          <span>Replying to {replyToMessage.senderName}</span>
          <strong>{replyToMessage.body || replyToMessage.fileName || "Attachment"}</strong>
          <button type="button" className="inline-text-button" onClick={() => setReplyToMessage(null)}>
            Clear
          </button>
        </div>
      ) : null}

      {messageInfo ? (
        <div className="workspace-chat-compose-preview">
          <span>{messageInfo.senderName || (messageInfo.senderId === currentUser?.id ? "You" : "Message")}</span>
          <strong>{formatDate(messageInfo.createdAt, { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}{messageInfo.status ? ` · ${messageInfo.status}` : ""}</strong>
          <button type="button" className="inline-text-button" onClick={() => setMessageInfo(null)}>
            Clear
          </button>
        </div>
      ) : null}

      {selectedAttachment ? (
        <div className="workspace-chat-compose-preview">
          <span>Attachment ready</span>
          <strong>{selectedAttachment.name}</strong>
          <button type="button" className="inline-text-button" onClick={() => setSelectedAttachment(null)}>
            Remove
          </button>
        </div>
      ) : null}

      {attachmentPreviewUrl ? <img src={attachmentPreviewUrl} alt="attachment preview" className="workspace-chat-image-preview workspace-chat-compose-image" /> : null}

      <div className="workspace-chat-composer workspace-chat-mobile-composer">
        <div className="workspace-chat-input-shell">
          <button type="button" className="workspace-chat-emoji-trigger" aria-label="Emoji picker">
            <span aria-hidden="true">&#9786;</span>
          </button>

          <textarea
            className="question-input workspace-chat-composer-input workspace-chat-mobile-input"
            rows={1}
            value={messageDraft}
            onChange={(event) => handleDraftChange(event.target.value)}
            placeholder={selectedItem ? `Message ${selectedItem.title}` : "Select a conversation to message"}
            disabled={!selectedConversation}
          />

          <label className="workspace-chat-attach-button" aria-label="Attach file">
            <span aria-hidden="true">&#128206;</span>
            <input type="file" accept={attachmentAccept} onChange={(event) => setSelectedAttachment(event.target.files?.[0] || null)} />
          </label>

          <button type="button" className="workspace-chat-emoji-button workspace-chat-inline-icon" aria-label="Payments">
            <span aria-hidden="true">&#8377;</span>
          </button>

          <button type="button" className="workspace-chat-camera-button" aria-label="Camera">
            <span aria-hidden="true">&#128247;</span>
          </button>
        </div>

        <button
          type="button"
          className="workspace-chat-send-fab"
          onClick={handleSendMessage}
          disabled={!selectedConversation || isSending}
          aria-label={composerActionLabel}
        >
          <span aria-hidden="true">{!messageDraft.trim() && !selectedAttachment ? "\uD83C\uDFA4" : isSending ? "..." : "\u27A4"}</span>
        </button>
      </div>
    </section>
  );
}

export default ChatConversationPane;
