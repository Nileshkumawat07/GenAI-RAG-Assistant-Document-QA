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
  return (
    <>
      <div className="insight-section">
        <div className="insight-card">
          <h3 className="tool-title">Query Guidance</h3>
          <p className="tool-copy">
            Ask for names, emails, phone numbers, skills, roles, dates, or
            project details for the clearest results. Upload one document, ask
            one focused question, then refine the wording if you want a more
            specific answer. A new upload replaces your current session
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
          <span className="answer-badge">{answer ? "Completed" : "Waiting"}</span>
        </div>

        <div className={`answer-box ${answer ? "has-answer" : ""}`}>
          {answer ? (
            <div className="answer-content">{renderAnswer(answer)}</div>
          ) : (
            <p>Upload a document and ask a question to view the answer here.</p>
          )}
        </div>
      </div>
    </>
  );
}

export default DocumentRetrievalPanel;
