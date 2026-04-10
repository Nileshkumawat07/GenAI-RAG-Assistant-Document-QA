import React from "react";

import { buildChatFileUrl } from "./chatManagementApi";

const QUICK_EMOJIS = ["\u{1F600}", "\u{1F44D}", "\u{1F525}", "\u{1F3AF}", "\u{1F64F}"];

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

      <div ref={conversationStreamRef} className="workspace-chat-conversation-stream">
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
                  <article key={message.id} className={`workspace-chat-bubble ${mine ? "is-user" : "is-assistant"} workspace-direct-message`}>
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
                            <a href={buildChatFileUrl(message.id)} target="_blank" rel="noreferrer" className="workspace-chat-media-link">
                              <img src={buildChatFileUrl(message.id)} alt={message.fileName || "attachment"} className="workspace-chat-image-preview" />
                            </a>
                          ) : (
                            <a href={buildChatFileUrl(message.id)} target="_blank" rel="noreferrer" className="workspace-chat-file-chip">
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

                    <div className="workspace-chat-inline-actions">
                      <button type="button" className="inline-text-button" onClick={() => setReplyToMessage(message)}>
                        Reply
                      </button>
                      {message.canEdit ? (
                        <button
                          type="button"
                          className="inline-text-button"
                          onClick={() => {
                            setEditingMessageId(message.id);
                            setEditingDraft(message.body || "");
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                      <button type="button" className="inline-text-button" onClick={() => handleDeleteMessage(message.id, "me")}>
                        Delete for me
                      </button>
                      {message.canDeleteForEveryone ? (
                        <button type="button" className="inline-text-button" onClick={() => handleDeleteMessage(message.id, "everyone")}>
                          Delete for everyone
                        </button>
                      ) : null}
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
      </div>

      {replyToMessage ? (
        <div className="workspace-chat-compose-preview">
          <span>Replying to {replyToMessage.senderName}</span>
          <strong>{replyToMessage.body || replyToMessage.fileName || "Attachment"}</strong>
          <button type="button" className="inline-text-button" onClick={() => setReplyToMessage(null)}>
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

          <div className="workspace-chat-emoji-row workspace-chat-inline-tools">
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} type="button" className="workspace-chat-emoji-button" onClick={() => handleDraftChange(`${messageDraft}${emoji}`)}>
                {emoji}
              </button>
            ))}
          </div>

          <label className="workspace-chat-attach-button" aria-label="Attach file">
            <span aria-hidden="true">&#128206;</span>
            <input type="file" accept={attachmentAccept} onChange={(event) => setSelectedAttachment(event.target.files?.[0] || null)} />
          </label>

          <button type="button" className="workspace-chat-camera-button" aria-label="Camera">
            <span aria-hidden="true">&#128247;</span>
          </button>
        </div>

        <button
          type="button"
          className="workspace-chat-send-fab"
          onClick={handleSendMessage}
          disabled={!selectedConversation || isSending || (!messageDraft.trim() && !selectedAttachment)}
          aria-label={isSending ? "Sending" : "Send message"}
        >
          <span aria-hidden="true">{isSending ? "..." : "\u27A4"}</span>
        </button>
      </div>
    </section>
  );
}

export default ChatConversationPane;
