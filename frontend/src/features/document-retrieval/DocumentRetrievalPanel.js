import React from "react";

import { renderAnswer } from "../../shared/utils/answerFormatting";

function DocumentRetrievalPanel({
  answer,
  askQuestion,
  hasQuestion,
  isAsking,
  isUploading,
  pushStatus,
  question,
  selectedFile,
  setError,
  setQuestion,
  setSelectedFile,
  uploadDocument,
}) {
  const selectedFileName = selectedFile?.name || "No file selected";
  const fileExtension = selectedFile?.name?.split(".").pop()?.toUpperCase() || "PDF/TXT";

  return (
    <div className="workspace-premium-shell">
      <section className="workspace-command-hero">
        <article className="workspace-hub-card workspace-command-story workspace-tool-premium-hero">
          <div className="workspace-command-topline">
            <div>
              <span className="workspace-command-kicker">Document Intelligence</span>
              <h3 className="workspace-command-title">Professional document retrieval for precise answers from uploaded context.</h3>
              <p className="workspace-command-lede">
                Upload one working document, frame a focused question, and turn dense files into a cleaner answer surface built for resumes, proposals, support docs, and delivery notes.
              </p>
            </div>
            <div className="workspace-chat-hero-pill">
              <span>Current source</span>
              <strong>{selectedFile ? "1" : "0"}</strong>
            </div>
          </div>

          <div className="workspace-command-badge-row">
            <article className="workspace-command-badge">
              <span>Accepted formats</span>
              <strong>PDF / TXT</strong>
              <p>Fast upload flow for document-centric retrieval.</p>
            </article>
            <article className="workspace-command-badge">
              <span>Answer mode</span>
              <strong>{answer ? "Ready" : "Waiting"}</strong>
              <p>Grounded response area tied to your active session document.</p>
            </article>
            <article className="workspace-command-badge">
              <span>Question state</span>
              <strong>{hasQuestion ? "Focused" : "Empty"}</strong>
              <p>Sharper prompts return cleaner extraction and fewer retries.</p>
            </article>
          </div>
        </article>

        <aside className="workspace-command-sidebar">
          <section className="workspace-hub-card workspace-spotlight-panel">
            <div className="workspace-spotlight-head">
              <span className="workspace-spotlight-tag">Active document</span>
            </div>
            <strong>{selectedFileName}</strong>
            <p>{selectedFile ? "The next upload replaces the current working document for this session." : "Select a PDF or TXT file to start document-grounded retrieval."}</p>
            <div className="workspace-focus-meta">
              <span>{fileExtension}</span>
              <span>{selectedFile ? "Ready to upload" : "No upload yet"}</span>
            </div>
          </section>
        </aside>
      </section>

      <section className="workspace-command-main">
        <article className="workspace-hub-card workspace-tool-form-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">Upload source</span>
              <h4>Load the working document</h4>
            </div>
            <span className="workspace-section-summary">Single-document session</span>
          </div>

          <label className="upload-box workspace-premium-upload-box">
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

          <button className="hero-button hero-button-primary" onClick={uploadDocument} disabled={!selectedFile || isUploading}>
            {isUploading ? "Uploading..." : "Upload Document"}
          </button>
        </article>

        <article className="workspace-hub-card workspace-tool-form-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">Query composer</span>
              <h4>Ask a targeted question</h4>
            </div>
            <span className="workspace-section-summary">Names, skills, dates, roles, contacts</span>
          </div>

          <textarea
            id="question-input"
            className="question-input workspace-tool-textarea"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What information do you want from this document?"
            rows={8}
          />

          <button className="hero-button hero-button-primary" onClick={askQuestion} disabled={isAsking || !hasQuestion}>
            {isAsking ? "Generating..." : "Generate Answer"}
          </button>
        </article>
      </section>

      <section className="workspace-hub-card workspace-tool-answer-card">
        <div className="workspace-section-heading">
          <div>
            <span className="workspace-hub-eyebrow">Answer output</span>
            <h4>Retrieved result</h4>
          </div>
          <span className="answer-badge">{answer ? "Completed" : "Waiting"}</span>
        </div>

        <div className={`answer-box workspace-tool-answer-box ${answer ? "has-answer" : ""}`}>
          {answer ? (
            <div className="answer-content">{renderAnswer(answer)}</div>
          ) : (
            <p>Upload a document and ask a question to view the answer here.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default DocumentRetrievalPanel;
