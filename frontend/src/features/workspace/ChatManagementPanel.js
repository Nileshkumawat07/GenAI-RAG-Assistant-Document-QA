import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  acceptFriendRequest,
  buildChatFileUrl,
  deleteChatMessage,
  getChatOverview,
  getChatWebSocketUrl,
  getConversationMessages,
  markConversationRead,
  rejectFriendRequest,
  searchChatUsers,
  sendFriendRequest,
  sendTextMessage,
  uploadChatAttachment,
} from "./chatManagementApi";

const QUICK_EMOJIS = ["😀", "👍", "🔥", "🎯", "🙏"];

function formatDate(value) {
  if (!value) return "Just now";
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Just now";
  }
}

function formatStatus(friend) {
  if (!friend) return "Select a chat";
  if (friend.presenceStatus === "online") return "Online";
  return friend.lastSeenAt ? `Last seen ${formatDate(friend.lastSeenAt)}` : "Offline";
}

function statusTicks(status) {
  if (status === "read") return "✓✓";
  if (status === "delivered") return "✓✓";
  return "✓";
}

function mergeMessageList(current, incoming) {
  const next = [...current];
  const index = next.findIndex((item) => item.id === incoming.id);
  if (index >= 0) {
    next[index] = { ...next[index], ...incoming };
  } else {
    next.push(incoming);
  }
  next.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  return next;
}

function ChatManagementPanel({ currentUser }) {
  const [overview, setOverview] = useState({ friends: [], sentRequests: [], receivedRequests: [], unreadMessageCount: 0, unreadRequestCount: 0 });
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [typingUserId, setTypingUserId] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  const selectedFriend = useMemo(
    () => overview.friends.find((item) => item.id === selectedFriendId) || overview.friends[0] || null,
    [overview.friends, selectedFriendId]
  );

  const attachmentPreviewUrl = useMemo(() => {
    if (!selectedAttachment || !selectedAttachment.type?.startsWith("image/")) return "";
    return URL.createObjectURL(selectedAttachment);
  }, [selectedAttachment]);

  useEffect(() => () => {
    if (attachmentPreviewUrl) {
      URL.revokeObjectURL(attachmentPreviewUrl);
    }
  }, [attachmentPreviewUrl]);

  const loadOverview = async () => {
    try {
      const data = await getChatOverview();
      setOverview(data);
      setSelectedFriendId((current) => (
        data.friends.some((item) => item.id === current) ? current : data.friends[0]?.id || ""
      ));
    } catch (error) {
      setPanelError(error.message || "Failed to load chat.");
    }
  };

  const loadConversation = async (friendId) => {
    if (!friendId) {
      setMessages([]);
      return;
    }
    try {
      const data = await getConversationMessages(friendId);
      setMessages(data || []);
      await markConversationRead(friendId);
      await loadOverview();
    } catch (error) {
      setPanelError(error.message || "Failed to load messages.");
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    loadConversation(selectedFriendId);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "active_chat", targetUserId: selectedFriendId || "" }));
    }
  }, [selectedFriendId]);

  useEffect(() => {
    if (!currentUser?.authToken) {
      return undefined;
    }

    const socket = new WebSocket(getChatWebSocketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setSocketReady(true);
      socket.send(JSON.stringify({ type: "active_chat", targetUserId: selectedFriendId || "" }));
    };
    socket.onclose = () => setSocketReady(false);
    socket.onerror = () => setSocketReady(false);
    socket.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "typing") {
          setTypingUserId(payload.isTyping ? payload.userId : "");
          return;
        }
        if (payload.type === "message:new") {
          const incoming = payload.message;
          if (incoming.senderId === selectedFriendId || incoming.receiverId === selectedFriendId) {
            setMessages((current) => mergeMessageList(current, incoming));
          }
          await loadOverview();
          return;
        }
        if (payload.type === "message:status") {
          setMessages((current) => current.map((item) => item.id === payload.messageId ? { ...item, status: payload.status, deliveredAt: payload.deliveredAt || item.deliveredAt, readAt: payload.readAt || item.readAt } : item));
          await loadOverview();
          return;
        }
        if (payload.type === "message:deleted") {
          await loadConversation(selectedFriendId);
          return;
        }
        if (payload.type === "overview:refresh" || payload.type === "friends:refresh" || payload.type === "friend_request:new" || payload.type === "presence") {
          await loadOverview();
        }
      } catch {
        // Ignore malformed socket payloads.
      }
    };

    return () => {
      try {
        socket.send(JSON.stringify({ type: "active_chat", targetUserId: "" }));
      } catch {
        // Ignore send failure during cleanup.
      }
      socket.close();
      socketRef.current = null;
    };
  }, [currentUser?.authToken, selectedFriendId]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return undefined;
    }
    const timeout = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        const results = await searchChatUsers(query);
        setSearchResults(results || []);
      } catch (error) {
        setPanelError(error.message || "Failed to search users.");
      } finally {
        setSearchLoading(false);
      }
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const sendTypingSignal = (isTyping) => {
    if (!selectedFriendId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: "typing", targetUserId: selectedFriendId, isTyping }));
  };

  const handleDraftChange = (value) => {
    setMessageDraft(value);
    sendTypingSignal(true);
    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => sendTypingSignal(false), 900);
  };

  const handleSendMessage = async () => {
    if (!selectedFriendId || (!messageDraft.trim() && !selectedAttachment)) return;
    try {
      setIsSending(true);
      setPanelError("");
      let sent;
      if (selectedAttachment) {
        sent = await uploadChatAttachment({
          receiverId: selectedFriendId,
          body: messageDraft.trim(),
          replyToMessageId: replyToMessage?.id || "",
          file: selectedAttachment,
        });
      } else {
        sent = await sendTextMessage({
          receiverId: selectedFriendId,
          body: messageDraft.trim(),
          replyToMessageId: replyToMessage?.id || null,
        });
      }
      setMessages((current) => mergeMessageList(current, sent));
      setMessageDraft("");
      setSelectedAttachment(null);
      setReplyToMessage(null);
      sendTypingSignal(false);
      await loadOverview();
    } catch (error) {
      setPanelError(error.message || "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId, scope) => {
    try {
      await deleteChatMessage(messageId, scope);
      await loadConversation(selectedFriendId);
    } catch (error) {
      setPanelError(error.message || "Failed to delete message.");
    }
  };

  const selectedFriendTyping = typingUserId && typingUserId === selectedFriendId;

  const handleRequestAction = async (requestId, action) => {
    try {
      if (action === "accept") {
        await acceptFriendRequest(requestId);
      } else {
        await rejectFriendRequest(requestId);
      }
      await loadOverview();
    } catch (error) {
      setPanelError(error.message || `Failed to ${action} request.`);
    }
  };

  const handleSendFriendRequest = async (userId) => {
    try {
      await sendFriendRequest(userId);
      await loadOverview();
      const refreshed = await searchChatUsers(searchQuery);
      setSearchResults(refreshed || []);
    } catch (error) {
      setPanelError(error.message || "Failed to send request.");
    }
  };

  return (
    <div className="workspace-premium-shell">
      <section className="workspace-command-hero">
        <article className="workspace-hub-card workspace-command-story workspace-tool-premium-hero">
          <div className="workspace-command-topline">
            <div>
              <span className="workspace-command-kicker">Chat Management</span>
              <h3 className="workspace-command-title">Full messaging, friend discovery, requests, and direct chat inside the workspace.</h3>
              <p className="workspace-command-lede">Facebook-style discovery, WhatsApp-style messaging, unread tracking, attachments, typing, presence, and live delivery status in one module.</p>
            </div>
            <div className="workspace-chat-hero-pill">
              <span>Unread</span>
              <strong>{overview.unreadMessageCount}</strong>
            </div>
          </div>
          <div className="workspace-command-badge-row">
            <article className="workspace-command-badge"><span>Friends</span><strong>{overview.friends.length}</strong><p>Accepted contacts ready for direct messaging.</p></article>
            <article className="workspace-command-badge"><span>Requests</span><strong>{overview.unreadRequestCount}</strong><p>Pending incoming requests waiting for action.</p></article>
            <article className="workspace-command-badge"><span>Realtime</span><strong>{socketReady ? "Live" : "Idle"}</strong><p>Presence, typing, delivery, and read updates.</p></article>
          </div>
        </article>
        <aside className="workspace-command-sidebar">
          <section className="workspace-hub-card workspace-spotlight-panel">
            <div className="workspace-spotlight-head"><span className="workspace-spotlight-tag">Active chat</span></div>
            <strong>{selectedFriend?.fullName || "No conversation selected"}</strong>
            <p>{selectedFriend ? formatStatus(selectedFriend) : "Choose a friend to open a direct conversation."}</p>
            <div className="workspace-focus-meta">
              <span>{selectedFriend?.username ? `@${selectedFriend.username}` : "Discovery available"}</span>
              <span>{socketReady ? "Socket connected" : "Socket disconnected"}</span>
            </div>
          </section>
        </aside>
      </section>

      {panelError ? <p className="error-text">{panelError}</p> : null}

      <section className="workspace-chat-management-grid">
        <aside className="workspace-hub-card workspace-chat-column">
          <div className="workspace-section-heading">
            <div><span className="workspace-hub-eyebrow">Recent chats</span><h4>Friends</h4></div>
            <span className="workspace-section-summary">{overview.friends.length}</span>
          </div>
          <div className="workspace-chat-list">
            {overview.friends.length > 0 ? overview.friends.map((friend) => (
              <button key={friend.id} type="button" className={`workspace-chat-list-item ${selectedFriend?.id === friend.id ? "is-active" : ""}`} onClick={() => setSelectedFriendId(friend.id)}>
                <div className="workspace-chat-avatar">{friend.avatarLabel}</div>
                <div className="workspace-chat-list-copy">
                  <div className="workspace-chat-list-head">
                    <strong>{friend.fullName}</strong>
                    <span>{friend.lastMessageAt ? formatDate(friend.lastMessageAt) : ""}</span>
                  </div>
                  <p>{friend.lastMessagePreview || `@${friend.username}`}</p>
                </div>
                {friend.unreadCount > 0 ? <span className="workspace-chat-unread-badge">{friend.unreadCount}</span> : null}
              </button>
            )) : <p className="status-item status-info">No friends yet.</p>}
          </div>
        </aside>

        <section className="workspace-hub-card workspace-chat-conversation-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">Conversation</span>
              <h4>{selectedFriend?.fullName || "Select a friend"}</h4>
            </div>
            <span className="workspace-section-summary">{selectedFriend ? formatStatus(selectedFriend) : "Direct messaging"}</span>
          </div>

          <div className="workspace-chat-conversation-stream">
            {selectedFriend ? messages.map((message) => {
              const mine = message.senderId === currentUser?.id;
              const isImage = message.messageType === "image";
              return (
                <article key={message.id} className={`workspace-chat-bubble ${mine ? "is-user" : "is-assistant"} workspace-direct-message`}>
                  {message.replyPreview ? (
                    <div className="workspace-chat-reply-preview">
                      <strong>{message.replyPreview.senderName}</strong>
                      <p>{message.replyPreview.body}</p>
                    </div>
                  ) : null}
                  {message.body ? <p>{message.body}</p> : null}
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
                  <div className="workspace-chat-bubble-foot">
                    <span>{formatDate(message.createdAt)}</span>
                    {mine ? <span>{statusTicks(message.status)} {message.status}</span> : null}
                  </div>
                  <div className="workspace-chat-inline-actions">
                    <button type="button" className="inline-text-button" onClick={() => setReplyToMessage(message)}>Reply</button>
                    <button type="button" className="inline-text-button" onClick={() => handleDeleteMessage(message.id, "me")}>Delete for me</button>
                    {mine ? <button type="button" className="inline-text-button" onClick={() => handleDeleteMessage(message.id, "everyone")}>Delete for everyone</button> : null}
                  </div>
                </article>
              );
            }) : <p className="status-item status-info">Select a friend to start chatting.</p>}
            {selectedFriendTyping ? <p className="status-item status-info">{selectedFriend?.fullName} is typing...</p> : null}
          </div>

          {replyToMessage ? (
            <div className="workspace-chat-compose-preview">
              <span>Replying to {replyToMessage.senderId === currentUser?.id ? "yourself" : selectedFriend?.fullName}</span>
              <strong>{replyToMessage.body || replyToMessage.fileName || "Attachment"}</strong>
              <button type="button" className="inline-text-button" onClick={() => setReplyToMessage(null)}>Clear</button>
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

          <div className="workspace-chat-composer">
            <div className="workspace-chat-emoji-row">
              {QUICK_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" className="workspace-chat-emoji-button" onClick={() => handleDraftChange(`${messageDraft}${emoji}`)}>{emoji}</button>
              ))}
              <label className="workspace-chat-attach-button">
                Attach
                <input type="file" onChange={(event) => setSelectedAttachment(event.target.files?.[0] || null)} />
              </label>
            </div>
            <textarea
              className="question-input workspace-chat-composer-input"
              rows={4}
              value={messageDraft}
              onChange={(event) => handleDraftChange(event.target.value)}
              placeholder={selectedFriend ? `Message ${selectedFriend.fullName}` : "Select a friend to message"}
              disabled={!selectedFriend}
            />
            <button type="button" className="hero-button hero-button-primary" onClick={handleSendMessage} disabled={!selectedFriend || isSending || (!messageDraft.trim() && !selectedAttachment)}>
              {isSending ? "Sending..." : "Send Message"}
            </button>
          </div>
        </section>

        <aside className="workspace-hub-card workspace-chat-column">
          <div className="workspace-section-heading">
            <div><span className="workspace-hub-eyebrow">Discovery</span><h4>Find users</h4></div>
            <span className="workspace-section-summary">{searchLoading ? "Searching" : "Live search"}</span>
          </div>
          <input className="workspace-input workspace-command-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by username or name" />
          <div className="workspace-chat-discovery-list">
            {searchResults.map((user) => (
              <article key={user.id} className="workspace-chat-discovery-card">
                <div className="workspace-chat-avatar">{user.avatarLabel}</div>
                <div>
                  <strong>{user.fullName}</strong>
                  <p>@{user.username} · {user.presenceStatus}</p>
                </div>
                <button type="button" className="admin-table-action-button" disabled={user.relationshipState !== "none"} onClick={() => handleSendFriendRequest(user.id)}>
                  {user.relationshipState === "none" ? "Add Friend" : user.relationshipState.replace("_", " ")}
                </button>
              </article>
            ))}
          </div>

          <div className="workspace-section-heading workspace-chat-side-section">
            <div><span className="workspace-hub-eyebrow">Requests</span><h4>Received</h4></div>
            <span className="workspace-section-summary">{overview.receivedRequests.length}</span>
          </div>
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

          <div className="workspace-section-heading workspace-chat-side-section">
            <div><span className="workspace-hub-eyebrow">Requests</span><h4>Sent</h4></div>
            <span className="workspace-section-summary">{overview.sentRequests.length}</span>
          </div>
          <div className="workspace-chat-request-list">
            {overview.sentRequests.length > 0 ? overview.sentRequests.map((item) => (
              <article key={item.id} className="workspace-chat-request-card">
                <strong>{item.receiver.fullName}</strong>
                <p>@{item.receiver.username}</p>
              </article>
            )) : <p className="status-item status-info">No sent requests.</p>}
          </div>
        </aside>
      </section>
    </div>
  );
}

export default ChatManagementPanel;
