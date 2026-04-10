import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChatConversationPane from "./ChatConversationPane";
import ChatDiscoveryPane from "./ChatDiscoveryPane";
import ChatRecentListPane from "./ChatRecentListPane";
import {
  acceptFriendRequest,
  addGroupMembers,
  addGroupToCommunity,
  createCommunity,
  createGroup,
  deleteChatMessage,
  deleteGroup,
  editChatMessage,
  exitGroup,
  getChatOverview,
  getChatWebSocketUrl,
  getCommunityDetail,
  getConversationMessages,
  getGroupDetail,
  joinCommunity,
  leaveCommunity,
  markConversationRead,
  rejectFriendRequest,
  removeGroupFromCommunity,
  removeGroupMember,
  searchChatUsers,
  sendFriendRequest,
  sendTextMessage,
  clearConversationBackground,
  updateCommunity,
  updateConversationBackground,
  updateGroup,
  updateGroupMemberRole,
  uploadChatAttachment,
} from "./chatManagementApi";

function mergeMessageList(current, incoming) {
  const next = [...current];
  const index = next.findIndex((item) => item.id === incoming.id);
  if (index >= 0) next[index] = { ...next[index], ...incoming };
  else next.push(incoming);
  next.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  return next;
}

function ChatManagementPanel({ currentUser }) {
  const [overview, setOverview] = useState({ friends: [], directChats: [], groups: [], communities: [], sentRequests: [], receivedRequests: [], unreadMessageCount: 0, unreadRequestCount: 0, unreadNotificationCount: 0 });
  const [activeTab, setActiveTab] = useState("chats");
  const [recentSearch, setRecentSearch] = useState("");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingDraft, setEditingDraft] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [typingState, setTypingState] = useState({ userId: "", conversationType: "", conversationId: "" });
  const [details, setDetails] = useState(null);
  const [requestFocus, setRequestFocus] = useState(false);
  const [createGroupState, setCreateGroupState] = useState({ name: "", description: "", image: null, memberIds: [] });
  const [createCommunityState, setCreateCommunityState] = useState({ name: "", description: "", image: null });
  const [memberInviteIds, setMemberInviteIds] = useState([]);
  const [communityGroupId, setCommunityGroupId] = useState("");
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const conversationStreamRef = useRef(null);
  const requestsRef = useRef(null);
  const selectedConversationRef = useRef(null);

  const currentItems = useMemo(() => {
    const source = activeTab === "groups" ? overview.groups : activeTab === "communities" ? overview.communities : overview.directChats;
    const query = recentSearch.trim().toLowerCase();
    return query ? source.filter((item) => `${item.title} ${item.subtitle || ""}`.toLowerCase().includes(query)) : source;
  }, [activeTab, overview, recentSearch]);

  const selectedItem = useMemo(() => {
    if (!selectedConversation) return null;
    return [...overview.directChats, ...overview.groups, ...overview.communities].find((item) => item.conversationType === selectedConversation.conversationType && item.id === selectedConversation.conversationId) || null;
  }, [overview, selectedConversation]);

  const attachmentPreviewUrl = useMemo(() => {
    if (!selectedAttachment || !selectedAttachment.type?.startsWith("image/")) return "";
    return URL.createObjectURL(selectedAttachment);
  }, [selectedAttachment]);

  useEffect(() => () => { if (attachmentPreviewUrl) window.URL.revokeObjectURL(attachmentPreviewUrl); }, [attachmentPreviewUrl]);

  const loadOverview = useCallback(async () => {
    const data = await getChatOverview();
    setOverview(data);
    setSelectedConversation((current) => {
      if (current && [...data.directChats, ...data.groups, ...data.communities].some((item) => item.conversationType === current.conversationType && item.id === current.conversationId)) return current;
      const fallback = data.directChats[0] || data.groups[0] || data.communities[0] || null;
      return fallback ? { conversationType: fallback.conversationType, conversationId: fallback.id } : null;
    });
  }, []);

  const loadConversation = useCallback(async (conversation, options = {}) => {
    if (!conversation?.conversationId) {
      setMessages([]);
      setHasMoreMessages(false);
      return;
    }
    const data = await getConversationMessages({ conversationType: conversation.conversationType, conversationId: conversation.conversationId, beforeMessageId: options.beforeMessageId, limit: 40 });
    if (options.prepend) setMessages((current) => [...(data.items || []), ...current.filter((item) => !(data.items || []).some((candidate) => candidate.id === item.id))]);
    else setMessages(data.items || []);
    setHasMoreMessages(Boolean(data.hasMore));
    await markConversationRead({ conversationType: conversation.conversationType, conversationId: conversation.conversationId });
  }, []);

  const loadDetails = useCallback(async (conversation) => {
    if (!conversation) return setDetails(null);
    if (conversation.conversationType === "group") return setDetails(await getGroupDetail(conversation.conversationId));
    if (conversation.conversationType === "community") return setDetails(await getCommunityDetail(conversation.conversationId));
    setDetails(null);
  }, []);

  const applyNavigationTarget = () => {
    try {
      const raw = window.sessionStorage.getItem("genai_chat_navigation_target");
      if (!raw) return;
      const target = JSON.parse(raw);
      window.sessionStorage.removeItem("genai_chat_navigation_target");
      if (target.actionType === "open_chat_requests") {
        setRequestFocus(true);
        window.setTimeout(() => requestsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      } else if (target.actionContext?.conversationType && target.actionContext?.conversationId) {
        setActiveTab(target.actionContext.conversationType === "group" ? "groups" : target.actionContext.conversationType === "community" ? "communities" : "chats");
        setSelectedConversation({ conversationType: target.actionContext.conversationType, conversationId: target.actionContext.conversationId });
      }
    } catch {
      // Ignore malformed navigation state.
    }
  };

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    loadOverview().catch((error) => setPanelError(error.message || "Failed to load chat."));
    applyNavigationTarget();
  }, [loadOverview]);

  useEffect(() => {
    const handleOpen = () => applyNavigationTarget();
    window.addEventListener("genai-open-chat-management", handleOpen);
    return () => window.removeEventListener("genai-open-chat-management", handleOpen);
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;
    loadConversation(selectedConversation).catch((error) => setPanelError(error.message || "Failed to load messages."));
    loadDetails(selectedConversation).catch(() => setDetails(null));
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "active_chat", conversationType: selectedConversation.conversationType, conversationId: selectedConversation.conversationId }));
    }
  }, [loadConversation, loadDetails, selectedConversation?.conversationType, selectedConversation?.conversationId]);

  useEffect(() => {
    if (!currentUser?.authToken) return undefined;
    const socket = new WebSocket(getChatWebSocketUrl());
    socketRef.current = socket;
    socket.onopen = () => {
      if (selectedConversation) socket.send(JSON.stringify({ type: "active_chat", conversationType: selectedConversation.conversationType, conversationId: selectedConversation.conversationId }));
    };
    socket.onclose = () => {};
    socket.onerror = () => {};
    socket.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "typing") return setTypingState(payload.isTyping ? payload : { userId: "", conversationType: "", conversationId: "" });
        if (payload.type === "message:new" && payload.message) {
          const activeConversation = selectedConversationRef.current;
          if (activeConversation && payload.message.conversationType === activeConversation.conversationType && payload.message.conversationId === activeConversation.conversationId) {
            setMessages((current) => mergeMessageList(current, payload.message));
          }
          return loadOverview();
        }
        if (payload.type === "message:updated" && payload.message) return setMessages((current) => current.map((item) => (item.id === payload.message.id ? { ...item, ...payload.message } : item)));
        if (payload.type === "message:status") {
          setMessages((current) => current.map((item) => (item.id === payload.messageId ? { ...item, status: payload.status, readAt: payload.readAt || item.readAt, deliveredAt: payload.deliveredAt || item.deliveredAt } : item)));
          return loadOverview();
        }
        if (payload.type === "message:deleted") {
          const activeConversation = selectedConversationRef.current;
          if (activeConversation) await loadConversation(activeConversation);
          return loadOverview();
        }
        if (["overview:refresh", "group:refresh", "community:refresh", "friends:refresh", "friend_request:new", "presence"].includes(payload.type)) {
          await loadOverview();
          const activeConversation = selectedConversationRef.current;
          if (activeConversation && (payload.type === "group:refresh" || payload.type === "community:refresh")) {
            await loadDetails(activeConversation).catch(() => setDetails(null));
          }
        }
      } catch {
        // Ignore malformed socket payloads.
      }
    };
    return () => {
      try {
        socket.send(JSON.stringify({ type: "active_chat", conversationType: "", conversationId: "" }));
      } catch {
        // Ignore cleanup errors.
      }
      socket.close();
      socketRef.current = null;
    };
  }, [currentUser?.authToken, loadConversation, loadDetails, loadOverview, selectedConversation?.conversationType, selectedConversation?.conversationId]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return undefined;
    }
    const timeout = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchResults((await searchChatUsers(query)) || []);
      } catch (error) {
        setPanelError(error.message || "Failed to search users.");
      } finally {
        setSearchLoading(false);
      }
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (conversationStreamRef.current) conversationStreamRef.current.scrollTop = conversationStreamRef.current.scrollHeight;
  }, [messages.length]);

  const sendTypingSignal = (isTyping) => {
    if (!selectedConversation || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: "typing", conversationType: selectedConversation.conversationType, conversationId: selectedConversation.conversationId, isTyping }));
  };

  const handleDraftChange = (value) => {
    setMessageDraft(value);
    sendTypingSignal(true);
    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => sendTypingSignal(false), 900);
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || (!messageDraft.trim() && !selectedAttachment)) return;
    try {
      setIsSending(true);
      const payload = { conversationType: selectedConversation.conversationType, conversationId: selectedConversation.conversationId, body: messageDraft.trim(), replyToMessageId: replyToMessage?.id || null };
      const sent = selectedAttachment ? await uploadChatAttachment({ ...payload, file: selectedAttachment }) : await sendTextMessage(payload);
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
      if (selectedConversation) await loadConversation(selectedConversation);
    } catch (error) {
      setPanelError(error.message || "Failed to delete message.");
    }
  };

  const handleSaveEdit = async (messageId) => {
    try {
      const updated = await editChatMessage(messageId, editingDraft);
      setMessages((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setEditingMessageId("");
      setEditingDraft("");
    } catch (error) {
      setPanelError(error.message || "Failed to edit message.");
    }
  };

  const handleRequestAction = async (requestId, action) => {
    try {
      if (action === "accept") await acceptFriendRequest(requestId);
      else await rejectFriendRequest(requestId);
      await loadOverview();
    } catch (error) {
      setPanelError(error.message || `Failed to ${action} request.`);
    }
  };

  const handleSendFriendRequest = async (userId) => {
    try {
      await sendFriendRequest(userId);
      await loadOverview();
    } catch (error) {
      setPanelError(error.message || "Failed to send request.");
    }
  };

  const handleCreateGroup = async () => {
    try {
      await createGroup(createGroupState);
      setCreateGroupState({ name: "", description: "", image: null, memberIds: [] });
      await loadOverview();
      setActiveTab("groups");
    } catch (error) {
      setPanelError(error.message || "Failed to create group.");
    }
  };

  const handleCreateCommunity = async () => {
    try {
      await createCommunity(createCommunityState);
      setCreateCommunityState({ name: "", description: "", image: null });
      await loadOverview();
      setActiveTab("communities");
    } catch (error) {
      setPanelError(error.message || "Failed to create community.");
    }
  };

  const handleUpdateConversationBackground = async (file) => {
    if (!selectedConversation || !file) return;
    try {
      await updateConversationBackground({
        conversationType: selectedConversation.conversationType,
        conversationId: selectedConversation.conversationId,
        file,
      });
      await loadOverview();
      await loadDetails(selectedConversation).catch(() => setDetails(null));
    } catch (error) {
      setPanelError(error.message || "Failed to update conversation background.");
    }
  };

  const handleClearConversationBackground = async () => {
    if (!selectedConversation) return;
    try {
      await clearConversationBackground({
        conversationType: selectedConversation.conversationType,
        conversationId: selectedConversation.conversationId,
      });
      await loadOverview();
      await loadDetails(selectedConversation).catch(() => setDetails(null));
    } catch (error) {
      setPanelError(error.message || "Failed to clear conversation background.");
    }
  };

  const selectedTyping = selectedConversation && typingState.conversationType === selectedConversation.conversationType && typingState.conversationId === selectedConversation.conversationId;
  const canManageMembers = details?.currentUserRole === "admin";

  return (
    <div className="workspace-premium-shell">
      {panelError ? <p className="error-text">{panelError}</p> : null}

      <section className="workspace-chat-management-grid">
        <ChatRecentListPane activeTab={activeTab} items={currentItems} recentSearch={recentSearch} selectedConversation={selectedConversation} setActiveTab={setActiveTab} setRecentSearch={setRecentSearch} setSelectedConversation={setSelectedConversation} />
        <ChatConversationPane currentUser={currentUser} selectedItem={selectedItem} selectedConversation={selectedConversation} messages={messages} hasMoreMessages={hasMoreMessages} conversationStreamRef={conversationStreamRef} selectedTyping={selectedTyping} editingMessageId={editingMessageId} editingDraft={editingDraft} setEditingDraft={setEditingDraft} setEditingMessageId={setEditingMessageId} replyToMessage={replyToMessage} setReplyToMessage={setReplyToMessage} selectedAttachment={selectedAttachment} setSelectedAttachment={setSelectedAttachment} attachmentPreviewUrl={attachmentPreviewUrl} messageDraft={messageDraft} handleDraftChange={handleDraftChange} handleSendMessage={handleSendMessage} handleDeleteMessage={handleDeleteMessage} handleSaveEdit={handleSaveEdit} isSending={isSending} loadOlderMessages={() => loadConversation(selectedConversation, { prepend: true, beforeMessageId: messages[0]?.id })} handleUpdateConversationBackground={handleUpdateConversationBackground} handleClearConversationBackground={handleClearConversationBackground} />
        <ChatDiscoveryPane overview={overview} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} searchLoading={searchLoading} handleSendFriendRequest={handleSendFriendRequest} createGroupState={createGroupState} setCreateGroupState={setCreateGroupState} handleCreateGroup={handleCreateGroup} createCommunityState={createCommunityState} setCreateCommunityState={setCreateCommunityState} handleCreateCommunity={handleCreateCommunity} details={details} canManageMembers={canManageMembers} memberInviteIds={memberInviteIds} setMemberInviteIds={setMemberInviteIds} communityGroupId={communityGroupId} setCommunityGroupId={setCommunityGroupId} currentUser={currentUser} requestsRef={requestsRef} requestFocus={requestFocus} handleRequestAction={handleRequestAction} setDetails={setDetails} setPanelError={setPanelError} loadOverview={loadOverview} addGroupMembers={addGroupMembers} addGroupToCommunity={addGroupToCommunity} deleteGroup={deleteGroup} exitGroup={exitGroup} joinCommunity={joinCommunity} leaveCommunity={leaveCommunity} overviewGroups={overview.groups} overviewFriends={overview.friends} removeGroupFromCommunity={removeGroupFromCommunity} removeGroupMember={removeGroupMember} updateCommunity={updateCommunity} updateGroup={updateGroup} updateGroupMemberRole={updateGroupMemberRole} clearSelection={() => { setSelectedConversation(null); setDetails(null); }} />
      </section>
    </div>
  );
}

export default ChatManagementPanel;
