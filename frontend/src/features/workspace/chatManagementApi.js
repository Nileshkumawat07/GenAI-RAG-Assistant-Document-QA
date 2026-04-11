import { apiUrl, requestJson } from "../../shared/api/http";
import { getAuthToken } from "../auth/authStorage";

function authHeaders(extra = {}) {
  const token = getAuthToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

function parseFormResponse(response, fallbackMessage) {
  return response.json().catch(() => ({})).then((data) => {
    if (!response.ok) {
      throw new Error(data.detail || fallbackMessage);
    }
    return data;
  });
}

export function getChatWebSocketUrl() {
  const token = getAuthToken();
  const configuredBase = (process.env.REACT_APP_API_BASE_URL || "").trim();
  const baseUrl = configuredBase || (window.location.hostname === "localhost" && window.location.port === "3000" ? "http://127.0.0.1:8000" : window.location.origin);
  const wsBase = baseUrl.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
  return `${wsBase}/chat/ws?token=${encodeURIComponent(token)}`;
}

export async function getChatOverview() {
  return requestJson("/chat/overview", { method: "GET" }, "Failed to load chat overview.");
}

export async function searchChatUsers(query) {
  return requestJson(`/chat/users/search?q=${encodeURIComponent(query)}`, { method: "GET" }, "Failed to search users.");
}

export async function searchChatDirectory(query) {
  return requestJson(`/chat/search?q=${encodeURIComponent(query)}`, { method: "GET" }, "Failed to search chats.");
}

export async function searchFriends(query) {
  return requestJson(`/chat/friends/search?q=${encodeURIComponent(query)}`, { method: "GET" }, "Failed to search friends.");
}

export async function sendFriendRequest(receiverId) {
  return requestJson("/chat/friend-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiverId }) }, "Failed to send friend request.");
}

export async function acceptFriendRequest(requestId) {
  return requestJson(`/chat/friend-requests/${encodeURIComponent(requestId)}/accept`, { method: "POST" }, "Failed to accept friend request.");
}

export async function rejectFriendRequest(requestId) {
  return requestJson(`/chat/friend-requests/${encodeURIComponent(requestId)}/reject`, { method: "POST" }, "Failed to reject friend request.");
}

export async function removeFriend(friendUserId) {
  return requestJson(`/chat/friends/${encodeURIComponent(friendUserId)}`, { method: "DELETE" }, "Failed to remove friend.");
}

export async function getConversationMessages({ conversationType, conversationId, beforeMessageId, limit = 40 }) {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (beforeMessageId) {
    query.set("before_message_id", beforeMessageId);
  }
  return requestJson(`/chat/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/messages?${query.toString()}`, { method: "GET" }, "Failed to load messages.");
}

export async function getConversationMessageContext({ conversationType, conversationId, messageId, window = 14 }) {
  const query = new URLSearchParams();
  query.set("window", String(window));
  return requestJson(
    `/chat/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/context?${query.toString()}`,
    { method: "GET" },
    "Failed to load message context."
  );
}

export async function getConversationSidebar({ conversationType, conversationId }) {
  return requestJson(
    `/chat/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/sidebar`,
    { method: "GET" },
    "Failed to load conversation details."
  );
}

export async function markConversationRead({ conversationType, conversationId }) {
  return requestJson(`/chat/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/read`, { method: "POST" }, "Failed to update message status.");
}

export async function updateConversationPreferences({ conversationType, conversationId, ...payload }) {
  return requestJson(
    `/chat/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/preferences`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    "Failed to update conversation settings."
  );
}

export async function clearChatConversation({ conversationType, conversationId }) {
  return requestJson(
    `/chat/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/clear`,
    { method: "POST" },
    "Failed to clear this chat."
  );
}

export async function getConversationStorage({ conversationType, conversationId }) {
  return requestJson(
    `/chat/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/storage`,
    { method: "GET" },
    "Failed to load storage usage."
  );
}

export async function deleteConversationMedia({ conversationType, conversationId }) {
  return requestJson(
    `/chat/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/delete-media`,
    { method: "POST" },
    "Failed to delete media from this chat."
  );
}

export async function updateConversationBackground({ conversationType, conversationId, file }) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(apiUrl(`/chat/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/background`), {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  return parseFormResponse(response, "Failed to update conversation background.");
}

export async function clearConversationBackground({ conversationType, conversationId }) {
  return requestJson(
    `/chat/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/background`,
    { method: "DELETE" },
    "Failed to clear conversation background."
  );
}

export async function sendTextMessage(payload) {
  return requestJson("/chat/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, "Failed to send message.");
}

export async function uploadChatAttachment({ receiverId, conversationType, conversationId, body, replyToMessageId, file }) {
  const formData = new FormData();
  if (receiverId) formData.append("receiver_id", receiverId);
  formData.append("conversation_type", conversationType || "direct");
  if (conversationId) formData.append("conversation_id", conversationId);
  formData.append("body", body || "");
  formData.append("reply_to_message_id", replyToMessageId || "");
  formData.append("file", file);
  const response = await fetch(apiUrl("/chat/messages/upload"), { method: "POST", headers: authHeaders(), body: formData });
  return parseFormResponse(response, "Failed to upload attachment.");
}

export async function editChatMessage(messageId, body) {
  return requestJson(`/chat/messages/${encodeURIComponent(messageId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) }, "Failed to edit message.");
}

export async function toggleMessageReaction(messageId, emoji) {
  return requestJson(
    `/chat/messages/${encodeURIComponent(messageId)}/reaction`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) },
    "Failed to update reaction."
  );
}

export async function toggleStarMessage(messageId) {
  return requestJson(`/chat/messages/${encodeURIComponent(messageId)}/star`, { method: "POST" }, "Failed to update starred state.");
}

export async function togglePinMessage(messageId) {
  return requestJson(`/chat/messages/${encodeURIComponent(messageId)}/pin`, { method: "POST" }, "Failed to update pinned state.");
}

export async function deleteChatMessage(messageId, scope) {
  return requestJson(`/chat/messages/${encodeURIComponent(messageId)}/delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope }) }, "Failed to delete message.");
}

export async function createGroup({ name, description, memberIds, image }) {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("description", description || "");
  formData.append("member_ids", JSON.stringify(memberIds || []));
  if (image) formData.append("image", image);
  const response = await fetch(apiUrl("/chat/groups"), { method: "POST", headers: authHeaders(), body: formData });
  return parseFormResponse(response, "Failed to create group.");
}

export async function updateGroup(groupId, { name, description, isMuted, image }) {
  const formData = new FormData();
  if (name !== undefined) formData.append("name", name || "");
  if (description !== undefined) formData.append("description", description || "");
  if (isMuted !== undefined && isMuted !== null) formData.append("is_muted", String(Boolean(isMuted)));
  if (image) formData.append("image", image);
  const response = await fetch(apiUrl(`/chat/groups/${encodeURIComponent(groupId)}`), { method: "PATCH", headers: authHeaders(), body: formData });
  return parseFormResponse(response, "Failed to update group.");
}

export async function addGroupMembers(groupId, userIds) {
  return requestJson(`/chat/groups/${encodeURIComponent(groupId)}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds }) }, "Failed to add group members.");
}

export async function removeGroupMember(groupId, userId) {
  return requestJson(`/chat/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }, "Failed to remove group member.");
}

export async function updateGroupMemberRole(groupId, userId, role) {
  return requestJson(`/chat/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }, "Failed to update member role.");
}

export async function exitGroup(groupId) {
  return requestJson(`/chat/groups/${encodeURIComponent(groupId)}/exit`, { method: "POST" }, "Failed to exit group.");
}

export async function deleteGroup(groupId) {
  return requestJson(`/chat/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" }, "Failed to delete group.");
}

export async function getGroupDetail(groupId) {
  return requestJson(`/chat/groups/${encodeURIComponent(groupId)}`, { method: "GET" }, "Failed to load group details.");
}

export async function createCommunity({ name, description, image }) {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("description", description || "");
  if (image) formData.append("image", image);
  const response = await fetch(apiUrl("/chat/communities"), { method: "POST", headers: authHeaders(), body: formData });
  return parseFormResponse(response, "Failed to create community.");
}

export async function updateCommunity(communityId, { name, description, isMuted, image }) {
  const formData = new FormData();
  if (name !== undefined) formData.append("name", name || "");
  if (description !== undefined) formData.append("description", description || "");
  if (isMuted !== undefined && isMuted !== null) formData.append("is_muted", String(Boolean(isMuted)));
  if (image) formData.append("image", image);
  const response = await fetch(apiUrl(`/chat/communities/${encodeURIComponent(communityId)}`), { method: "PATCH", headers: authHeaders(), body: formData });
  return parseFormResponse(response, "Failed to update community.");
}

export async function getCommunityDetail(communityId) {
  return requestJson(`/chat/communities/${encodeURIComponent(communityId)}`, { method: "GET" }, "Failed to load community details.");
}

export async function joinCommunity(communityId) {
  return requestJson(`/chat/communities/${encodeURIComponent(communityId)}/join`, { method: "POST" }, "Failed to join community.");
}

export async function leaveCommunity(communityId) {
  return requestJson(`/chat/communities/${encodeURIComponent(communityId)}/leave`, { method: "POST" }, "Failed to leave community.");
}

export async function addGroupToCommunity(communityId, groupId) {
  return requestJson(`/chat/communities/${encodeURIComponent(communityId)}/groups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId }) }, "Failed to add group to community.");
}

export async function removeGroupFromCommunity(communityId, groupId) {
  return requestJson(`/chat/communities/${encodeURIComponent(communityId)}/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" }, "Failed to remove group from community.");
}

export async function uploadChatProfilePhoto(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(apiUrl("/chat/profile/photo"), {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  return parseFormResponse(response, "Failed to upload profile photo.");
}

export function buildChatFileUrl(messageId) {
  const token = getAuthToken();
  return apiUrl(`/chat/files/${encodeURIComponent(messageId)}?token=${encodeURIComponent(token)}`);
}

export function buildChatAssetUrl(entityType, entityId, fileUrl) {
  if (!fileUrl) return "";
  if (/^https?:/i.test(fileUrl)) return fileUrl;
  const token = getAuthToken();
  return apiUrl(`${fileUrl}${fileUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`);
}

export function buildChatAuthenticatedUrl(fileUrl) {
  if (!fileUrl) return "";
  if (/^https?:/i.test(fileUrl)) return fileUrl;
  const token = getAuthToken();
  return apiUrl(`${fileUrl}${fileUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`);
}
