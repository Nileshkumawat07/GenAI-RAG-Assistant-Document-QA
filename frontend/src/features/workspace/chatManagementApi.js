import { apiUrl, requestJson } from "../../shared/api/http";
import { getAuthToken } from "../auth/authStorage";

function authHeaders(extra = {}) {
  const token = getAuthToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export function getChatWebSocketUrl() {
  const token = getAuthToken();
  const configuredBase = (process.env.REACT_APP_API_BASE_URL || "").trim();
  const baseUrl = configuredBase
    || (window.location.hostname === "localhost" && window.location.port === "3000"
      ? "http://127.0.0.1:8000"
      : window.location.origin);
  const wsBase = baseUrl.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
  return `${wsBase}/chat/ws?token=${encodeURIComponent(token)}`;
}

export async function getChatOverview() {
  return requestJson("/chat/overview", { method: "GET" }, "Failed to load chat overview.");
}

export async function searchChatUsers(query) {
  return requestJson(`/chat/users/search?q=${encodeURIComponent(query)}`, { method: "GET" }, "Failed to search users.");
}

export async function sendFriendRequest(receiverId) {
  return requestJson(
    "/chat/friend-requests",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId }),
    },
    "Failed to send friend request."
  );
}

export async function acceptFriendRequest(requestId) {
  return requestJson(`/chat/friend-requests/${encodeURIComponent(requestId)}/accept`, { method: "POST" }, "Failed to accept friend request.");
}

export async function rejectFriendRequest(requestId) {
  return requestJson(`/chat/friend-requests/${encodeURIComponent(requestId)}/reject`, { method: "POST" }, "Failed to reject friend request.");
}

export async function getConversationMessages(friendUserId) {
  return requestJson(`/chat/conversations/${encodeURIComponent(friendUserId)}/messages`, { method: "GET" }, "Failed to load messages.");
}

export async function markConversationRead(friendUserId) {
  return requestJson(`/chat/conversations/${encodeURIComponent(friendUserId)}/read`, { method: "POST" }, "Failed to update message status.");
}

export async function sendTextMessage(payload) {
  return requestJson(
    "/chat/messages",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to send message."
  );
}

export async function uploadChatAttachment({ receiverId, body, replyToMessageId, file }) {
  const formData = new FormData();
  formData.append("receiver_id", receiverId);
  formData.append("body", body || "");
  formData.append("reply_to_message_id", replyToMessageId || "");
  formData.append("file", file);

  const response = await fetch(apiUrl("/chat/messages/upload"), {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Failed to upload attachment.");
  }
  return data;
}

export async function deleteChatMessage(messageId, scope) {
  return requestJson(
    `/chat/messages/${encodeURIComponent(messageId)}/delete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    },
    "Failed to delete message."
  );
}

export function buildChatFileUrl(messageId) {
  const token = getAuthToken();
  return apiUrl(`/chat/files/${encodeURIComponent(messageId)}?token=${encodeURIComponent(token)}`);
}
