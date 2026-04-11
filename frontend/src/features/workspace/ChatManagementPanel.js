import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChatConversationPane from "./ChatConversationPane";
import ChatDiscoveryPane from "./ChatDiscoveryPane";
import ChatRecentListPane from "./ChatRecentListPane";
import { fetchCurrentSessionUser } from "../auth/authApi";
import {
  acceptFriendRequest,
  addGroupMembers,
  addGroupToCommunity,
  clearChatConversation,
  createCommunity,
  createGroup,
  deleteConversationMedia,
  deleteCommunity,
  deleteChatMessage,
  deleteGroup,
  editChatMessage,
  exitGroup,
  getChatOverview,
  getConversationMessageContext,
  getConversationSidebar,
  getConversationMessages,
  joinCommunity,
  leaveCommunity,
  markConversationRead,
  rejectFriendRequest,
  removeFriend,
  removeGroupFromCommunity,
  removeGroupMember,
  searchChatUsers,
  searchChatDirectory,
  sendFriendRequest,
  sendTextMessage,
  clearConversationBackground,
  toggleMessageReaction,
  togglePinMessage,
  toggleStarMessage,
  updateCommunity,
  updateConversationPreferences,
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

function buildConversationRoomKey(currentUserId, conversationType, conversationId) {
  if (!conversationType || !conversationId) return "";
  if (conversationType === "direct") {
    return `direct:${[currentUserId, conversationId].filter(Boolean).sort().join("__")}`;
  }
  return `${conversationType}:${conversationId}`;
}

function ChatManagementPanel({ currentUser, onUserUpdate }) {
  const [overview, setOverview] = useState({ friends: [], directChats: [], groups: [], communities: [], sentRequests: [], receivedRequests: [], unreadMessageCount: 0, unreadRequestCount: 0, unreadNotificationCount: 0 });
  const [activeTab, setActiveTab] = useState("chats");
  const [listFilter, setListFilter] = useState("all");
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
  const [searchResults, setSearchResults] = useState({ users: [], messages: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [typingState, setTypingState] = useState({ userId: "", conversationType: "", conversationId: "" });
  const [highlightedMessageId, setHighlightedMessageId] = useState("");
  const [details, setDetails] = useState(null);
  const [requestFocus, setRequestFocus] = useState(false);
  const [createGroupState, setCreateGroupState] = useState({ name: "", description: "", image: null, memberIds: [] });
  const [createCommunityState, setCreateCommunityState] = useState({ name: "", description: "", image: null });
  const [memberInviteIds, setMemberInviteIds] = useState([]);
  const [communityGroupId, setCommunityGroupId] = useState("");
  const [toastItems, setToastItems] = useState([]);
  const typingTimeoutRef = useRef(null);
  const socketReadyRef = useRef(Boolean(window.__GENAI_CHAT_SOCKET_READY__));
  const conversationStreamRef = useRef(null);
  const requestsRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const currentUserIdRef = useRef(currentUser?.id || "");
  const overviewRef = useRef(overview);
  const toastIdRef = useRef(0);
  const pendingJumpRef = useRef(null);
  const conversationLoadVersionRef = useRef(0);

  const currentItems = useMemo(() => {
    const source = activeTab === "groups" ? overview.groups : activeTab === "communities" ? overview.communities : overview.directChats;
    const query = recentSearch.trim().toLowerCase();
    const filtered = source.filter((item) => {
      if (listFilter === "unread" && !item.unreadCount) return false;
      if (listFilter === "archived" && !item.isArchived) return false;
      if (listFilter === "all" && item.isArchived) return false;
      return query ? `${item.title} ${item.subtitle || ""}`.toLowerCase().includes(query) : true;
    });
    return [...filtered].sort((first, second) => {
      if (Boolean(first.isPinned) !== Boolean(second.isPinned)) return first.isPinned ? -1 : 1;
      const firstTime = new Date(first.lastMessageAt || 0).getTime();
      const secondTime = new Date(second.lastMessageAt || 0).getTime();
      if (firstTime !== secondTime) return secondTime - firstTime;
      return first.title.localeCompare(second.title);
    });
  }, [activeTab, listFilter, overview, recentSearch]);

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
    const requestVersion = conversationLoadVersionRef.current + 1;
    conversationLoadVersionRef.current = requestVersion;
    const data = await getConversationMessages({ conversationType: conversation.conversationType, conversationId: conversation.conversationId, beforeMessageId: options.beforeMessageId, limit: 40 });
    const stillCurrent =
      selectedConversationRef.current?.conversationType === conversation.conversationType &&
      selectedConversationRef.current?.conversationId === conversation.conversationId &&
      conversationLoadVersionRef.current === requestVersion;
    if (!stillCurrent) return;
    if (options.prepend) setMessages((current) => [...(data.items || []), ...current.filter((item) => !(data.items || []).some((candidate) => candidate.id === item.id))]);
    else setMessages((current) => {
      if (!current.length) return data.items || [];
      const merged = [...(data.items || [])];
      current.forEach((item) => {
        if (!merged.some((candidate) => candidate.id === item.id)) {
          merged.push(item);
        }
      });
      merged.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      return merged;
    });
    setHasMoreMessages(Boolean(data.hasMore));
    await markConversationRead({ conversationType: conversation.conversationType, conversationId: conversation.conversationId });
  }, []);

  const loadDetails = useCallback(async (conversation) => {
    if (!conversation) return setDetails(null);
    return setDetails(
      await getConversationSidebar({
        conversationType: conversation.conversationType,
        conversationId: conversation.conversationId,
      })
    );
  }, []);

  const openConversationAtMessage = useCallback(({ conversationType, conversationId, messageId }) => {
    if (!conversationType || !conversationId || !messageId) return;
    pendingJumpRef.current = { conversationType, conversationId, messageId };
    setActiveTab(conversationType === "group" ? "groups" : conversationType === "community" ? "communities" : "chats");
    setSelectedConversation({ conversationType, conversationId });
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

  const pushToast = useCallback((text) => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    setToastItems((current) => [...current, { id, text }].slice(-4));
    window.setTimeout(() => {
      setToastItems((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const refreshCurrentSessionUser = useCallback(async () => {
    if (!onUserUpdate) return;
    const latestUser = await fetchCurrentSessionUser();
    onUserUpdate(latestUser);
  }, [onUserUpdate]);

  const sendSocketPayload = useCallback((payload) => {
    if (!payload || !socketReadyRef.current) return false;
    window.dispatchEvent(new CustomEvent("genai-chat-socket-send", { detail: payload }));
    return true;
  }, []);

  const sendActiveConversationSignal = useCallback((conversation = selectedConversationRef.current) => {
    sendSocketPayload({
      type: "active_chat",
      conversationType: conversation?.conversationType || "",
      conversationId: conversation?.conversationId || "",
    });
  }, [sendSocketPayload]);

  const isConversationActive = useCallback((conversationType, conversationId, roomKey = "", message = null) => {
    const activeConversation = selectedConversationRef.current;
    if (!activeConversation) return false;
    const currentUserId = currentUserIdRef.current;
    const activeRoomKey = buildConversationRoomKey(
      currentUserId,
      activeConversation.conversationType,
      activeConversation.conversationId
    );
    const targetRoomKey = roomKey || buildConversationRoomKey(currentUserId, conversationType, conversationId);
    if (
      activeConversation.conversationType === "direct" &&
      conversationType === "direct" &&
      [
        conversationId,
        message?.conversationId,
        message?.senderId,
        message?.receiverId,
      ].filter(Boolean).includes(activeConversation.conversationId)
    ) {
      return true;
    }
    if (
      activeConversation.conversationType === "group" &&
      conversationType === "group" &&
      [conversationId, message?.conversationId, message?.groupId].filter(Boolean).includes(activeConversation.conversationId)
    ) {
      return true;
    }
    if (
      activeConversation.conversationType === "community" &&
      conversationType === "community" &&
      [conversationId, message?.conversationId, message?.groupId].filter(Boolean).includes(activeConversation.conversationId)
    ) {
      return true;
    }
    return (
      (conversationType === activeConversation.conversationType &&
        conversationId === activeConversation.conversationId) ||
      (activeRoomKey && targetRoomKey && activeRoomKey === targetRoomKey)
    );
  }, []);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    currentUserIdRef.current = currentUser?.id || "";
  }, [currentUser?.id]);

  useEffect(() => {
    overviewRef.current = overview;
  }, [overview]);

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
    sendActiveConversationSignal(selectedConversation);
    if (!selectedConversation) {
      setMessages([]);
      setHasMoreMessages(false);
      setHighlightedMessageId("");
      return;
    }
    const pendingJump = pendingJumpRef.current;
    if (
      pendingJump &&
      pendingJump.conversationType === selectedConversation.conversationType &&
      pendingJump.conversationId === selectedConversation.conversationId
    ) {
      pendingJumpRef.current = null;
      getConversationMessageContext({
        conversationType: pendingJump.conversationType,
        conversationId: pendingJump.conversationId,
        messageId: pendingJump.messageId,
      })
        .then(async (data) => {
          setMessages(data.items || []);
          setHasMoreMessages(Boolean(data.hasBefore));
          setHighlightedMessageId(data.focusMessageId || pendingJump.messageId);
          await markConversationRead({ conversationType: pendingJump.conversationType, conversationId: pendingJump.conversationId });
          await loadDetails(selectedConversation).catch(() => setDetails(null));
          await loadOverview();
        })
        .catch((error) => setPanelError(error.message || "Failed to open this message."));
    } else {
      setHighlightedMessageId("");
      loadConversation(selectedConversation).catch((error) => setPanelError(error.message || "Failed to load messages."));
      loadDetails(selectedConversation).catch(() => setDetails(null));
    }
  }, [loadConversation, loadDetails, loadOverview, selectedConversation?.conversationType, selectedConversation?.conversationId, sendActiveConversationSignal]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const handleSocketOpen = () => {
      socketReadyRef.current = true;
      sendActiveConversationSignal();
    };

    const handleSocketClose = () => {
      socketReadyRef.current = false;
    };

    const handleSocketMessage = async (event) => {
      try {
        const payload = event?.detail;
        if (!payload) return;
        if (payload.type === "typing" || payload.type === "stop_typing") {
          return setTypingState(payload.isTyping ? payload : { userId: "", conversationType: "", conversationId: "" });
        }
        if (payload.type === "message:error") {
          setIsSending(false);
          setPanelError(payload.detail || "Failed to send message.");
          return;
        }
        if ((payload.type === "message:new" || payload.type === "receive_message") && payload.message) {
          setIsSending(false);
          const activeConversation = selectedConversationRef.current;
          const isActiveConversation = isConversationActive(
            payload.message.conversationType,
            payload.message.conversationId,
            payload.roomKey,
            payload.message
          );

          if (isActiveConversation) {
            setMessages((current) => mergeMessageList(current, payload.message));
            if (payload.message.senderId !== currentUserIdRef.current && activeConversation) {
              sendSocketPayload({
                type: "seen",
                conversationType: activeConversation.conversationType,
                conversationId: activeConversation.conversationId,
              });
            }
          } else {
            const sourceItems = [
              ...(overviewRef.current?.directChats || []),
              ...(overviewRef.current?.groups || []),
              ...(overviewRef.current?.communities || []),
            ];
            const incomingItem = sourceItems.find(
              (item) => item.conversationType === payload.message.conversationType && item.id === payload.message.conversationId
            );
            if (!incomingItem?.isMuted) {
              pushToast(`${payload.message.senderName}: ${payload.message.body || payload.message.fileName || "New message"}`);
            }
          }
          await loadOverview();
          return loadDetails(selectedConversationRef.current).catch(() => setDetails(null));
        }
        if (payload.type === "message:updated" && payload.message) {
          setMessages((current) => current.map((item) => (item.id === payload.message.id ? { ...item, ...payload.message } : item)));
          return loadDetails(selectedConversationRef.current).catch(() => setDetails(null));
        }
        if (payload.type === "message:status" || payload.type === "seen") {
          setMessages((current) => current.map((item) => (item.id === payload.messageId ? { ...item, status: payload.status, readAt: payload.readAt || item.readAt, deliveredAt: payload.deliveredAt || item.deliveredAt } : item)));
          return loadOverview();
        }
        if (payload.type === "message:deleted") {
          const activeConversation = selectedConversationRef.current;
          if (activeConversation) await loadConversation(activeConversation);
          await loadOverview();
          return loadDetails(activeConversation).catch(() => setDetails(null));
        }
        if (payload.type === "conversation:refresh") {
          const activeConversation = selectedConversationRef.current;
          const isActiveConversation = isConversationActive(
            payload.conversationType,
            payload.conversationId,
            payload.roomKey
          );
          if (isActiveConversation) {
            await loadConversation(activeConversation).catch(() => {});
            return loadDetails(activeConversation).catch(() => setDetails(null));
          }
          return undefined;
        }
        if (payload.type === "notification:new") {
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

    window.addEventListener("genai-chat-socket-open", handleSocketOpen);
    window.addEventListener("genai-chat-socket-close", handleSocketClose);
    window.addEventListener("genai-chat-socket-message", handleSocketMessage);
    socketReadyRef.current = Boolean(window.__GENAI_CHAT_SOCKET_READY__);
    if (socketReadyRef.current) {
      sendActiveConversationSignal();
    }

    return () => {
      window.removeEventListener("genai-chat-socket-open", handleSocketOpen);
      window.removeEventListener("genai-chat-socket-close", handleSocketClose);
      window.removeEventListener("genai-chat-socket-message", handleSocketMessage);
      window.dispatchEvent(new CustomEvent("genai-chat-socket-send", {
        detail: { type: "active_chat", conversationType: "", conversationId: "" },
      }));
      socketReadyRef.current = false;
    };
  }, [currentUser?.id, isConversationActive, loadConversation, loadDetails, loadOverview, pushToast, sendActiveConversationSignal, sendSocketPayload]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults({ users: [], messages: [] });
      return undefined;
    }
    const timeout = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        const [directory, users] = await Promise.all([
          searchChatDirectory(query),
          searchChatUsers(query),
        ]);
        setSearchResults({
          users: directory?.users?.length ? directory.users : users || [],
          messages: directory?.messages || [],
        });
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

  useEffect(() => {
    if (!highlightedMessageId) return undefined;
    const timeout = window.setTimeout(() => setHighlightedMessageId(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [highlightedMessageId]);

  const sendTypingSignal = (isTyping) => {
    if (!selectedConversation) return;
    sendSocketPayload({
      type: "typing",
      conversationType: selectedConversation.conversationType,
      conversationId: selectedConversation.conversationId,
      isTyping,
    });
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
      const payload = {
        conversationType: selectedConversation.conversationType,
        conversationId: selectedConversation.conversationId,
        receiverId: selectedConversation.conversationType === "direct" ? selectedConversation.conversationId : undefined,
        body: messageDraft.trim(),
        replyToMessageId: replyToMessage?.id || null,
      };
      if (!selectedAttachment && sendSocketPayload({ type: "send_message", ...payload })) {
      } else {
        const sent = selectedAttachment ? await uploadChatAttachment({ ...payload, file: selectedAttachment }) : await sendTextMessage(payload);
        setMessages((current) => mergeMessageList(current, sent));
      }
      setMessageDraft("");
      setSelectedAttachment(null);
      setReplyToMessage(null);
      sendTypingSignal(false);
      await loadOverview();
      await loadDetails(selectedConversation).catch(() => setDetails(null));
      if (selectedAttachment || !socketReadyRef.current) {
        setIsSending(false);
      }
    } catch (error) {
      setPanelError(error.message || "Failed to send message.");
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

  const handleRemoveFriend = async () => {
    const activeConversation = selectedConversationRef.current;
    if (!activeConversation || activeConversation.conversationType !== "direct") return;
    try {
      await removeFriend(activeConversation.conversationId);
      setMessages([]);
      setHasMoreMessages(false);
      setDetails(null);
      setSelectedConversation(null);
      await loadOverview();
    } catch (error) {
      setPanelError(error.message || "Failed to remove friend.");
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

  const handleDeleteCommunity = async () => {
    const activeConversation = selectedConversationRef.current;
    if (!activeConversation || activeConversation.conversationType !== "community") return;
    try {
      await deleteCommunity(activeConversation.conversationId);
      setMessages([]);
      setHasMoreMessages(false);
      setDetails(null);
      setSelectedConversation(null);
      await loadOverview();
    } catch (error) {
      setPanelError(error.message || "Failed to delete community.");
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

  const handleToggleReaction = async (messageId, emoji) => {
    try {
      const updated = await toggleMessageReaction(messageId, emoji);
      setMessages((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      await loadDetails(selectedConversationRef.current).catch(() => setDetails(null));
    } catch (error) {
      setPanelError(error.message || "Failed to update reaction.");
    }
  };

  const handleToggleStar = async (messageId) => {
    try {
      const updated = await toggleStarMessage(messageId);
      setMessages((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      await loadDetails(selectedConversationRef.current).catch(() => setDetails(null));
    } catch (error) {
      setPanelError(error.message || "Failed to update starred state.");
    }
  };

  const handleTogglePin = async (messageId) => {
    try {
      const updated = await togglePinMessage(messageId);
      setMessages((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      await loadDetails(selectedConversationRef.current).catch(() => setDetails(null));
    } catch (error) {
      setPanelError(error.message || "Failed to update pinned state.");
    }
  };

  const handleUpdateConversationPreference = async (payload) => {
    if (!selectedConversationRef.current) return null;
    try {
      await updateConversationPreferences({
        conversationType: selectedConversationRef.current.conversationType,
        conversationId: selectedConversationRef.current.conversationId,
        ...payload,
      });
      await loadOverview();
      await loadDetails(selectedConversationRef.current).catch(() => setDetails(null));
      return true;
    } catch (error) {
      setPanelError(error.message || "Failed to update conversation settings.");
      return false;
    }
  };

  const handleClearConversation = async () => {
    if (!selectedConversationRef.current) return;
    try {
      await clearChatConversation({
        conversationType: selectedConversationRef.current.conversationType,
        conversationId: selectedConversationRef.current.conversationId,
      });
      setMessages([]);
      setHasMoreMessages(false);
      await loadOverview();
      await loadDetails(selectedConversationRef.current).catch(() => setDetails(null));
    } catch (error) {
      setPanelError(error.message || "Failed to clear chat.");
    }
  };

  const handleDeleteConversationMedia = async () => {
    if (!selectedConversationRef.current) return;
    try {
      await deleteConversationMedia({
        conversationType: selectedConversationRef.current.conversationType,
        conversationId: selectedConversationRef.current.conversationId,
      });
      if (selectedConversationRef.current) {
        await loadConversation(selectedConversationRef.current);
      }
      await loadDetails(selectedConversationRef.current).catch(() => setDetails(null));
    } catch (error) {
      setPanelError(error.message || "Failed to delete media from this chat.");
    }
  };

  const handleChatProfileUpdated = async () => {
    await refreshCurrentSessionUser().catch(() => {});
    await loadOverview();
    await loadDetails(selectedConversationRef.current).catch(() => setDetails(null));
  };

  const refreshSelectedConversation = async () => {
    await loadOverview();
    await loadDetails(selectedConversationRef.current).catch(() => setDetails(null));
  };

  const selectedTyping = selectedConversation && typingState.conversationType === selectedConversation.conversationType && typingState.conversationId === selectedConversation.conversationId;
  const canManageMembers = details?.currentUserRole === "admin";

  return (
    <div className="workspace-premium-shell">
      {panelError ? <p className="error-text">{panelError}</p> : null}
      {toastItems.length > 0 ? (
        <div className="workspace-chat-toast-stack">
          {toastItems.map((item) => (
            <div key={item.id} className="workspace-chat-toast">
              {item.text}
            </div>
          ))}
        </div>
      ) : null}

      <section className="workspace-chat-management-grid">
        <ChatRecentListPane activeTab={activeTab} items={currentItems} listFilter={listFilter} recentSearch={recentSearch} selectedConversation={selectedConversation} typingState={typingState} setActiveTab={setActiveTab} setListFilter={setListFilter} setRecentSearch={setRecentSearch} setSelectedConversation={setSelectedConversation} />
        <ChatConversationPane currentUser={currentUser} selectedItem={selectedItem} selectedConversation={selectedConversation} messages={messages} hasMoreMessages={hasMoreMessages} conversationStreamRef={conversationStreamRef} selectedTyping={selectedTyping} highlightedMessageId={highlightedMessageId} editingMessageId={editingMessageId} editingDraft={editingDraft} setEditingDraft={setEditingDraft} setEditingMessageId={setEditingMessageId} replyToMessage={replyToMessage} setReplyToMessage={setReplyToMessage} selectedAttachment={selectedAttachment} setSelectedAttachment={setSelectedAttachment} attachmentPreviewUrl={attachmentPreviewUrl} messageDraft={messageDraft} handleDraftChange={handleDraftChange} handleSendMessage={handleSendMessage} handleDeleteMessage={handleDeleteMessage} handleSaveEdit={handleSaveEdit} handleToggleReaction={handleToggleReaction} handleToggleStar={handleToggleStar} handleTogglePin={handleTogglePin} isSending={isSending} loadOlderMessages={() => loadConversation(selectedConversation, { prepend: true, beforeMessageId: messages[0]?.id })} handleUpdateConversationBackground={handleUpdateConversationBackground} handleClearConversationBackground={handleClearConversationBackground} handleRemoveFriend={handleRemoveFriend} />
        <ChatDiscoveryPane overview={overview} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} searchLoading={searchLoading} handleSendFriendRequest={handleSendFriendRequest} handleOpenSearchMessage={openConversationAtMessage} createGroupState={createGroupState} setCreateGroupState={setCreateGroupState} handleCreateGroup={handleCreateGroup} createCommunityState={createCommunityState} setCreateCommunityState={setCreateCommunityState} handleCreateCommunity={handleCreateCommunity} selectedConversation={selectedConversation} details={details} canManageMembers={canManageMembers} memberInviteIds={memberInviteIds} setMemberInviteIds={setMemberInviteIds} communityGroupId={communityGroupId} setCommunityGroupId={setCommunityGroupId} currentUser={currentUser} onUserUpdate={onUserUpdate} requestsRef={requestsRef} requestFocus={requestFocus} handleRequestAction={handleRequestAction} handleUpdateConversationPreference={handleUpdateConversationPreference} handleClearConversation={handleClearConversation} handleDeleteConversationMedia={handleDeleteConversationMedia} handleChatProfileUpdated={handleChatProfileUpdated} refreshSelectedConversation={refreshSelectedConversation} setDetails={setDetails} setPanelError={setPanelError} loadOverview={loadOverview} addGroupMembers={addGroupMembers} addGroupToCommunity={addGroupToCommunity} deleteGroup={deleteGroup} exitGroup={exitGroup} joinCommunity={joinCommunity} leaveCommunity={leaveCommunity} overviewGroups={overview.groups} overviewFriends={overview.friends} removeGroupFromCommunity={removeGroupFromCommunity} removeGroupMember={removeGroupMember} updateCommunity={updateCommunity} updateGroup={updateGroup} updateGroupMemberRole={updateGroupMemberRole} handleRemoveFriend={handleRemoveFriend} handleDeleteCommunity={handleDeleteCommunity} clearSelection={() => { setSelectedConversation(null); setDetails(null); }} />
      </section>
    </div>
  );
}

export default ChatManagementPanel;
