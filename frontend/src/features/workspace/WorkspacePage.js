import React, { useState } from "react";

import DocumentRetrievalPanel from "../document-retrieval/DocumentRetrievalPanel";
import ObjectDetectionPanel from "../object-detection/ObjectDetectionPanel";
import { requestJson } from "../../shared/api/http";
import { getSessionId } from "../../shared/session/session";

function WorkspacePage() {
  const [activeSection, setActiveSection] = useState("document-retrieval");
  const [sessionId] = useState(() => getSessionId());
  const [selectedFile, setSelectedFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [statusFeed, setStatusFeed] = useState([
    { text: "Document retrieval ready.", type: "info" },
    { text: "Upload a document to begin.", type: "info" },
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
      const data = await requestJson(
        "/documents/upload",
        {
          method: "POST",
          headers: {
            "X-Session-Id": sessionId,
          },
          body: formData,
        },
        "Document upload failed."
      );

      setUploadStatus(`Document indexed successfully with ${data.chunks} chunks.`);
      pushStatus(`Document indexed successfully with ${data.chunks} chunks.`, "success");
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
      const data = await requestJson(
        "/query",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Id": sessionId,
          },
          body: JSON.stringify({ question }),
        },
        "Question answering failed."
      );

      setAnswer(data.answer);
      pushStatus("Answer generated successfully.", "success");
    } catch (err) {
      setAnswer(err.message);
    } finally {
      setIsAsking(false);
    }
  };

  const infoMessage =
    activeSection === "document-retrieval"
      ? "Transform your documents into an instant answer workspace with fast retrieval and precise responses."
      : "Use Groq vision to inspect an uploaded image and return detected objects with counts and approximate locations.";

  return (
    <section id="workspace" className="workspace-page">
      <div className="workspace-shell">
        <aside className="workspace-sidebar">
          <h1 className="sidebar-title">Assistant</h1>
          <p className="sidebar-description">Separate tools for retrieval and object detection</p>

          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeSection === "document-retrieval" ? "active" : ""}`}
              onClick={() => setActiveSection("document-retrieval")}
              type="button"
            >
              Document Retrieval
            </button>
            <button
              className={`sidebar-tab ${activeSection === "object-detection" ? "active" : ""}`}
              onClick={() => setActiveSection("object-detection")}
              type="button"
            >
              Object Detection
            </button>
          </div>

          <div className="sidebar-boost-card">
            <div className="sidebar-status">
              <h4>
                {activeSection === "document-retrieval"
                  ? "Document Retrieval Status"
                  : "Object Detection Status"}
              </h4>
              <div className="status-feed">
                {activeSection === "document-retrieval" ? (
                  statusFeed.map((item) => (
                    <p key={`${item.type}-${item.text}`} className={`status-item status-${item.type}`}>
                      {item.text}
                    </p>
                  ))
                ) : (
                  <>
                    <p className="status-item status-info">Object detection is ready.</p>
                    <p className="status-item status-info">Upload an image to analyze visible objects.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>

        <div className="workspace-content">
          <div className="info-card">
            <p>{infoMessage}</p>
          </div>

          <div className={`content-card ${activeSection === "object-detection" ? "object-detection-mode" : ""}`}>
            {activeSection === "document-retrieval" ? (
              <DocumentRetrievalPanel
                answer={answer}
                askQuestion={askQuestion}
                hasQuestion={hasQuestion}
                isAsking={isAsking}
                isUploading={isUploading}
                pushStatus={pushStatus}
                question={question}
                selectedFile={selectedFile}
                setError={setError}
                setQuestion={setQuestion}
                setSelectedFile={setSelectedFile}
                uploadDocument={uploadDocument}
              />
            ) : (
              <ObjectDetectionPanel />
            )}

            {(error || uploadStatus) && activeSection === "document-retrieval" ? (
              <div>
                {error ? <p className="error-text">{error}</p> : null}
                {uploadStatus ? <p className="success-text">{uploadStatus}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default WorkspacePage;
