import React from "react";

import { buildChatFileUrl } from "./chatManagementApi";

const QUICK_EMOJIS = ["\u{1F600}", "\u{1F44D}", "\u{1F525}", "\u{1F3AF}", "\u{1F64F}"];

function formatDate(value) {
  if (!value) return "Just now";
  try {
    return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Just now";
  }
}

function statusTicks(status) {
  if (status === "read") return "\u2713\u2713";
  if (status === "delivered") return "\u2713\u2713";
  return "\u2713";
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
  return (
    <section className="workspace-hub-card workspace-chat-conversation-card">
      <div className="workspace-section-heading">
        <div><span className="workspace-hub-eyebrow">Conversation</span><h4>{selectedItem?.title || "Select a chat"}</h4></div>
        <span className="workspace-section-summary">{selectedItem?.statusText || "Messaging hub"}</span>
      </div>

      <div ref={conversationStreamRef} className="workspace-chat-conversation-stream">
        {hasMoreMessages ? <button type="button" className="hero-button hero-button-secondary workspace-chat-load-more" onClick={loadOlderMessages}>Load older messages</button> : null}
        {selectedConversation ? messages.map((message) => {
          const mine = message.senderId === currentUser?.id;
          const isImage = message.messageType === "image";
          return (
            <article key={message.id} className={`workspace-chat-bubble ${mine ? "is-user" : "is-assistant"} workspace-direct-message`}>
              {!mine && selectedConversation.conversationType !== "direct" ? <strong className="workspace-chat-sender-line">{message.senderName}</strong> : null}
              {message.replyPreview ? <div className="workspace-chat-reply-preview"><strong>{message.replyPreview.senderName}</strong><p>{message.replyPreview.body}</p></div> : null}
              {editingMessageId === message.id ? (
                <div className="workspace-chat-edit-shell">
                  <textarea className="question-input workspace-chat-composer-input" rows={3} value={editingDraft} onChange={(event) => setEditingDraft(event.target.value)} />
                  <div className="workspace-chat-inline-actions">
                    <button type="button" className="inline-text-button" onClick={() => handleSaveEdit(message.id)}>Save</button>
                    <button type="button" className="inline-text-button" onClick={() => { setEditingMessageId(""); setEditingDraft(""); }}>Cancel</button>
                  </div>
                </div>
              ) : message.body ? <p>{message.body}</p> : null}
              {message.fileUrl ? (
                isImage ? (
                  <a href={buildChatFileUrl(message.id)} target="_blank" rel="noreferrer" className="workspace-chat-media-link">
                    <img src={buildChatFileUrl(message.id)} alt={message.fileName || "attachment"} className="workspace-chat-image-preview" />
                  </a>
                ) : (
                  <a href={buildChatFileUrl(message.id)} target="_blank" rel="noreferrer" className="workspace-chat-file-chip">{message.fileName || "Download file"}</a>
                )
              ) : null}
              <div className="workspace-chat-bubble-foot">
                <span>{formatDate(message.createdAt)} {message.editedAt ? "· edited" : ""}</span>
                {mine ? <span>{statusTicks(message.status)} {message.status}</span> : null}
              </div>
              <div className="workspace-chat-inline-actions">
                <button type="button" className="inline-text-button" onClick={() => setReplyToMessage(message)}>Reply</button>
                {message.canEdit ? <button type="button" className="inline-text-button" onClick={() => { setEditingMessageId(message.id); setEditingDraft(message.body || ""); }}>Edit</button> : null}
                <button type="button" className="inline-text-button" onClick={() => handleDeleteMessage(message.id, "me")}>Delete for me</button>
                {message.canDeleteForEveryone ? <button type="button" className="inline-text-button" onClick={() => handleDeleteMessage(message.id, "everyone")}>Delete for everyone</button> : null}
              </div>
            </article>
          );
        }) : <p className="status-item status-info">Select a chat, group, or community to start messaging.</p>}
        {selectedTyping ? <p className="status-item status-info">Someone is typing...</p> : null}
      </div>

      {replyToMessage ? <div className="workspace-chat-compose-preview"><span>Replying to {replyToMessage.senderName}</span><strong>{replyToMessage.body || replyToMessage.fileName || "Attachment"}</strong><button type="button" className="inline-text-button" onClick={() => setReplyToMessage(null)}>Clear</button></div> : null}
      {selectedAttachment ? <div className="workspace-chat-compose-preview"><span>Attachment ready</span><strong>{selectedAttachment.name}</strong><button type="button" className="inline-text-button" onClick={() => setSelectedAttachment(null)}>Remove</button></div> : null}
      {attachmentPreviewUrl ? <img src={attachmentPreviewUrl} alt="attachment preview" className="workspace-chat-image-preview workspace-chat-compose-image" /> : null}

      <div className="workspace-chat-composer">
        <div className="workspace-chat-emoji-row">
          {QUICK_EMOJIS.map((emoji) => <button key={emoji} type="button" className="workspace-chat-emoji-button" onClick={() => handleDraftChange(`${messageDraft}${emoji}`)}>{emoji}</button>)}
          <label className="workspace-chat-attach-button">Attach<input type="file" onChange={(event) => setSelectedAttachment(event.target.files?.[0] || null)} /></label>
        </div>
        <textarea className="question-input workspace-chat-composer-input" rows={4} value={messageDraft} onChange={(event) => handleDraftChange(event.target.value)} placeholder={selectedItem ? `Message ${selectedItem.title}` : "Select a conversation to message"} disabled={!selectedConversation} />
        <button type="button" className="hero-button hero-button-primary" onClick={handleSendMessage} disabled={!selectedConversation || isSending || (!messageDraft.trim() && !selectedAttachment)}>{isSending ? "Sending..." : "Send Message"}</button>
      </div>
    </section>
  );
}

export default ChatConversationPane;
