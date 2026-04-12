import React from "react";

import { buildChatFileUrl } from "./chatManagementApi";

function DiscoverySectionTitle({ eyebrow, title, summary, icon }) {
  return (
    <div className="workspace-chat-section-heading">
      <div className="workspace-chat-section-heading-main">
        <span className="workspace-chat-section-icon" aria-hidden="true">{icon}</span>
        <div>
          <span className="workspace-hub-eyebrow">{eyebrow}</span>
          <h4>{title}</h4>
        </div>
      </div>
      {summary ? <span className="workspace-section-summary">{summary}</span> : null}
    </div>
  );
}

function ChatDiscoveryPane({ overview, details, requestsRef, requestFocus, handleRequestAction }) {
  return (
    <aside className="workspace-hub-card workspace-chat-column workspace-chat-discovery-panel">
      <div className="workspace-section-heading">
        <div><span className="workspace-hub-eyebrow">Discovery</span><h4>Shared content</h4></div>
        <span className="workspace-section-summary">{details ? "Live" : "Standby"}</span>
      </div>

      <div className="workspace-chat-discovery-scroll">
        {details ? (
          <div className="workspace-chat-side-section workspace-chat-settings-card">
            <div className="workspace-chat-side-section workspace-chat-settings-subcard">
              <DiscoverySectionTitle eyebrow="Shared media" title="Images and videos" summary={`${details.sharedMedia?.length || 0}`} icon="MD" />
              <div className="workspace-chat-member-list">
                {(details.sharedMedia || []).map((item) => <a key={item.id} href={buildChatFileUrl(item.id)} target="_blank" rel="noreferrer" className="workspace-chat-member-card workspace-chat-media-card"><strong>{item.fileName || item.messageType}</strong><p>{item.senderName}</p></a>)}
                {!details.sharedMedia?.length ? <p className="status-item status-info">No shared media yet.</p> : null}
              </div>
            </div>

            <div className="workspace-chat-side-section workspace-chat-settings-subcard">
              <DiscoverySectionTitle eyebrow="Starred" title="Messages" summary={`${details.starredMessages?.length || 0}`} icon="ST" />
              <div className="workspace-chat-member-list">{(details.starredMessages || []).map((item) => <article key={item.id} className="workspace-chat-member-card"><strong>{item.senderName}</strong><p>{item.body || item.fileName || item.messageType}</p></article>)}{!details.starredMessages?.length ? <p className="status-item status-info">No starred messages yet.</p> : null}</div>
            </div>

            <div className="workspace-chat-side-section workspace-chat-settings-subcard">
              <DiscoverySectionTitle eyebrow="Pinned" title="Messages" summary={`${details.pinnedMessages?.length || 0}`} icon="PN" />
              <div className="workspace-chat-member-list">{(details.pinnedMessages || []).map((item) => <article key={item.id} className="workspace-chat-member-card"><strong>{item.senderName}</strong><p>{item.body || item.fileName || item.messageType}</p></article>)}{!details.pinnedMessages?.length ? <p className="status-item status-info">No pinned messages yet.</p> : null}</div>
            </div>
          </div>
        ) : (
          <p className="status-item status-info">Select a chat to view shared media and pinned content.</p>
        )}

        <div ref={requestsRef} className={`workspace-chat-side-section ${requestFocus ? "is-focus" : ""}`}>
          <div className="workspace-section-heading"><div><span className="workspace-hub-eyebrow">Requests</span><h4>Received</h4></div><span className="workspace-section-summary">{overview.receivedRequests.length}</span></div>
          <div className="workspace-chat-request-list">{overview.receivedRequests.length > 0 ? overview.receivedRequests.map((item) => <article key={item.id} className="workspace-chat-request-card"><strong>{item.sender.fullName}</strong><p>@{item.sender.username}</p><div className="workspace-hub-actions"><button type="button" className="admin-table-action-button" onClick={() => handleRequestAction(item.id, "accept")}>Accept</button><button type="button" className="admin-table-action-button" onClick={() => handleRequestAction(item.id, "reject")}>Reject</button></div></article>) : <p className="status-item status-info">No received requests.</p>}</div>
        </div>

        <div className="workspace-chat-side-section">
          <div className="workspace-section-heading"><div><span className="workspace-hub-eyebrow">Requests</span><h4>Sent</h4></div><span className="workspace-section-summary">{overview.sentRequests.length}</span></div>
          <div className="workspace-chat-request-list">{overview.sentRequests.length > 0 ? overview.sentRequests.map((item) => <article key={item.id} className="workspace-chat-request-card"><strong>{item.receiver.fullName}</strong><p>@{item.receiver.username}</p></article>) : <p className="status-item status-info">No sent requests.</p>}</div>
        </div>
      </div>
    </aside>
  );
}

export default ChatDiscoveryPane;
