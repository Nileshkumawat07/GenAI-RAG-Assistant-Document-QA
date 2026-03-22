import React, { useState } from "react";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const SESSION_STORAGE_KEY = "document_assistant_session_id";

const apiUrl = (path) => `${API_BASE}${path}`;

function getSessionId() {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created =
    window.crypto?.randomUUID?.() ||
    `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function requestJson(path, options, fallbackMessage) {
  try {
    const response = await fetch(apiUrl(path), options);
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(data.detail || fallbackMessage);
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Connection failed.");
    }

    throw error;
  }
}

function Chat() {
  const [sessionId] = useState(() => getSessionId());
  const [selectedFile, setSelectedFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [statusFeed, setStatusFeed] = useState([
    { text: "Workspace ready.", type: "info" },
    { text: "Upload a document to begin.", type: "info" }
  ]);
  const hasQuestion = question.trim().length > 0;

  const pushStatus = (text, type = "info") => {
    setStatusFeed((current) =>
      [{ text, type }, ...current.filter((item) => item.text !== text)].slice(0, 6)
    );
  };

  const uploadDocument = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus("");
    setError("");
    pushStatus(`Uploading ${selectedFile.name}...`);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const data = await requestJson("/documents/upload", {
        method: "POST",
        headers: {
          "X-Session-Id": sessionId
        },
        body: formData
      }, "Document upload failed.");

      setUploadStatus(
        `${data.filename} indexed successfully with ${data.chunks} chunks.`
      );
      pushStatus(`${data.filename} indexed successfully with ${data.chunks} chunks.`, "success");
    } catch (err) {
      setError(err.message);
      pushStatus(`Upload failed: ${err.message}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;

    setIsAsking(true);
    setAnswer("");
    setError("");
    pushStatus(`Question submitted: ${question.trim()}`);

    try {
      const data = await requestJson("/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sessionId
        },
        body: JSON.stringify({ question })
      }, "Question answering failed.");

      setAnswer(data.answer);
      pushStatus("Answer generated successfully.", "success");
    } catch (err) {
      setAnswer(err.message);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <section id="workspace" className="workspace-page">
      <div className="workspace-shell">
        <aside className="workspace-sidebar">
          <h1 className="sidebar-title">Assistant</h1>
          <p className="sidebar-description">Focused document workspace</p>

          <div className="sidebar-tabs">
            <button className="sidebar-tab active">Workspace</button>
          </div>

          <div className="sidebar-boost-card">
            <div className="sidebar-status">
              <h4>Workspace Status</h4>
              <div className="status-feed">
                {statusFeed.map((item) => (
                  <p key={`${item.type}-${item.text}`} className={`status-item status-${item.type}`}>
                    {item.text}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="workspace-content">
          <div className="info-card">
            <p>
              Transform your documents into an instant answer workspace with
              fast retrieval and precise responses.
            </p>
          </div>

          <div className="content-card">
            <div className="insight-section">
              <div className="insight-card">
                <h3 className="tool-title">Query Guidance</h3>
                <p className="tool-copy">
                  Ask for names, emails, phone numbers, skills, roles, dates, or
                  project details for the clearest results. Upload one document,
                  ask one focused question, then refine the wording if you want a
                  more specific answer. A new upload replaces your current session
                  document only.
                </p>
              </div>
            </div>

            <div className="content-grid">
              <article className="tool-card">
                <h3 className="tool-title">Upload Document</h3>
                <p className="tool-copy">Select the document you want to query.</p>

                <label className="upload-box">
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={(event) => {
                      const file = event.target.files[0] || null;
                      setError("");

                      if (!file) {
                        setSelectedFile(null);
                        return;
                      }

                      const isValidType = /\.(pdf|txt)$/i.test(file.name);
                      if (!isValidType) {
                        setSelectedFile(null);
                        setError("Only PDF and TXT files are allowed.");
                        pushStatus("Invalid file selected. Only PDF and TXT files are allowed.", "error");
                        return;
                      }

                      if (file.size === 0) {
                        setSelectedFile(null);
                        setError("Selected file is empty.");
                        pushStatus(`Invalid file: ${file.name} is empty.`, "error");
                        return;
                      }

                      setSelectedFile(file);
                      pushStatus(`Selected document: ${file.name}`);
                    }}
                  />
                  <span className="upload-icon">+</span>
                  <strong>{selectedFile ? selectedFile.name : "Choose a document"}</strong>
                  <small>Supported formats: PDF and TXT</small>
                </label>

                <button
                  className="primary-button"
                  onClick={uploadDocument}
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? "Uploading..." : "Upload Document"}
                </button>
              </article>

              <article className="tool-card">
                <h3 className="tool-title">Ask Question</h3>
                <p className="tool-copy">Type a clear question about the uploaded file.</p>

               
                <textarea
                  id="question-input"
                  className="question-input"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What information do you want from this document?"
                  rows={7}
                />

                <button
                  className="primary-button secondary-tone"
                  onClick={askQuestion}
                  disabled={isAsking || !hasQuestion}
                >
                  {isAsking ? "Generating..." : "Generate Answer"}
                </button>
              </article>
            </div>

            <div className="answer-section">
              <div className="answer-card-head">
                <div>
                  <h3 className="tool-title">Answer</h3>
                  <p className="tool-copy">Generated result for your current query.</p>
                </div>
                <span className="answer-badge">
                  {answer ? "Completed" : "Waiting"}
                </span>
              </div>

              <div className={`answer-box ${answer ? "has-answer" : ""}`}>
                {answer ? (
                  <p>{answer}</p>
                ) : (
                  <p>Upload a document and ask a question to view the answer here.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Chat;
