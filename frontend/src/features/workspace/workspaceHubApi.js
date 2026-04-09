import { requestJson } from "../../shared/api/http";

export async function getWorkspaceDashboard() {
  return requestJson("/workspace/dashboard", { method: "GET" }, "Failed to load dashboard.");
}

export async function getWorkspaceNotifications() {
  return requestJson("/workspace/notifications", { method: "GET" }, "Failed to load notifications.");
}

export async function markWorkspaceNotificationRead(notificationId) {
  return requestJson(
    `/workspace/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST" },
    "Failed to update notification."
  );
}

export async function markAllWorkspaceNotificationsRead() {
  return requestJson("/workspace/notifications/read-all", { method: "POST" }, "Failed to update notifications.");
}

export async function getWorkspaceAnalytics() {
  return requestJson("/workspace/analytics", { method: "GET" }, "Failed to load analytics.");
}

export async function getWorkspaceChats() {
  return requestJson("/workspace/chats", { method: "GET" }, "Failed to load chat history.");
}

export async function createWorkspaceChatThread(payload) {
  return requestJson(
    "/workspace/chats",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to create the chat thread."
  );
}

export async function getWorkspaceChatMessages(threadId) {
  return requestJson(
    `/workspace/chats/${encodeURIComponent(threadId)}/messages`,
    { method: "GET" },
    "Failed to load chat messages."
  );
}

export async function createWorkspaceChatMessage(threadId, payload) {
  return requestJson(
    `/workspace/chats/${encodeURIComponent(threadId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to save the chat message."
  );
}

export async function deleteWorkspaceChatThread(threadId) {
  return requestJson(
    `/workspace/chats/${encodeURIComponent(threadId)}`,
    { method: "DELETE" },
    "Failed to delete the chat thread."
  );
}

export async function getWorkspaceTeams() {
  return requestJson("/workspace/teams", { method: "GET" }, "Failed to load teams.");
}

export async function getWorkspaceUsers() {
  return requestJson("/workspace/users", { method: "GET" }, "Failed to load workspace users.");
}

export async function createWorkspaceTeam(payload) {
  return requestJson(
    "/workspace/teams",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to create the team."
  );
}

export async function addWorkspaceTeamMember(teamId, payload) {
  return requestJson(
    `/workspace/teams/${encodeURIComponent(teamId)}/members`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to add the team member."
  );
}

export async function updateWorkspaceTeamMember(teamId, membershipId, payload) {
  return requestJson(
    `/workspace/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(membershipId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to update the team member."
  );
}

export async function removeWorkspaceTeamMember(teamId, membershipId) {
  return requestJson(
    `/workspace/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(membershipId)}`,
    { method: "DELETE" },
    "Failed to remove the team member."
  );
}
