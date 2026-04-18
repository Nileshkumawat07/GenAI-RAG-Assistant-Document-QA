import React, { useEffect, useMemo, useState } from "react";

import { renderAnswer } from "../../shared/utils/answerFormatting";
import { pushToast } from "../../shared/toast/toastBus";

const FILE_LIBRARY_STORAGE_KEY = "genai_document_file_library";
const SOURCE_TAG_OPTIONS = ["Resume", "Invoice", "Knowledge Base", "Contract", "Research", "Support"];

function formatFileSize(size = 0) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${size} B`;
}

function formatTimestamp(value) {
  return value ? new Date(value).toLocaleString("en-GB") : "Just now";
}

function createLibraryRecord(file) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    size: file.size,
    type: file.name?.split(".").pop()?.toUpperCase() || "FILE",
    uploadedAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    status: "selected",
    archived: false,
    preview: `Ready for upload • ${formatFileSize(file.size)}`,
    tags: [SOURCE_TAG_OPTIONS.find((item) => item === "Knowledge Base")],
  };
}

function readLibrary() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(FILE_LIBRARY_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLibrary(items) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FILE_LIBRARY_STORAGE_KEY, JSON.stringify(items));
}

function DocumentRetrievalPanel({
  answer,
  askQuestion,
  hasQuestion,
  isAsking,
  isUploading,
  question,
  selectedFile,
  setError,
  setQuestion,
  setSelectedFile,
  uploadDocument,
}) {
  const [fileLibrary, setFileLibrary] = useState(() => readLibrary());
  const [activeLibraryId, setActiveLibraryId] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("recent");

  useEffect(() => {
    writeLibrary(fileLibrary);
  }, [fileLibrary]);

  useEffect(() => {
    if (!selectedFile) {
      return;
    }

    setFileLibrary((current) => {
      const existing = current.find((item) => item.name === selectedFile.name && item.size === selectedFile.size && !item.archived);
      if (existing) {
        setActiveLibraryId(existing.id);
        return current.map((item) =>
          item.id === existing.id
            ? { ...item, lastOpenedAt: new Date().toISOString(), status: "selected" }
            : item
        );
      }

      const nextRecord = createLibraryRecord(selectedFile);
      setActiveLibraryId(nextRecord.id);
      return [nextRecord, ...current].slice(0, 24);
    });
  }, [selectedFile]);

  const activeFileRecord = useMemo(
    () => fileLibrary.find((item) => item.id === activeLibraryId) || fileLibrary.find((item) => !item.archived) || null,
    [activeLibraryId, fileLibrary]
  );
  const filteredLibrary = useMemo(() => {
    if (libraryFilter === "archived") {
      return fileLibrary.filter((item) => item.archived);
    }

    const activeItems = fileLibrary.filter((item) => !item.archived);
    if (libraryFilter === "tagged") {
      return activeItems.filter((item) => (item.tags || []).length > 0);
    }

    return activeItems;
  }, [fileLibrary, libraryFilter]);

  const selectedFileName = selectedFile?.name || activeFileRecord?.name || "No file selected";
  const fileExtension = selectedFile?.name?.split(".").pop()?.toUpperCase() || activeFileRecord?.type || "PDF/TXT";

  const updateRecord = (recordId, updater) => {
    setFileLibrary((current) =>
      current.map((item) => (item.id === recordId ? { ...item, ...updater(item) } : item))
    );
  };

  const handleFileSelection = (event) => {
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
      pushToast({ type: "error", title: "Unsupported file", message: "Only PDF and TXT files are allowed." });
      return;
    }

    if (file.size === 0) {
      setSelectedFile(null);
      setError("Selected file is empty.");
      pushToast({ type: "error", title: "Empty file", message: `${file.name} is empty, so it cannot be uploaded.` });
      return;
    }

    setSelectedFile(file);
    pushToast({ type: "info", title: "File staged", message: `${file.name} is ready for upload.` });
  };

  const handleUpload = async () => {
    if (!selectedFile || !activeFileRecord) {
      return;
    }

    try {
      const data = await uploadDocument();
      updateRecord(activeFileRecord.id, () => ({
        status: "uploaded",
        uploadedAt: new Date().toISOString(),
        preview: `Indexed successfully • ${data?.chunks || 0} chunks`,
      }));
      pushToast({
        type: "success",
        title: "Document indexed",
        message: `${activeFileRecord.name} is ready for grounded answers.`,
      });
    } catch (uploadError) {
      updateRecord(activeFileRecord.id, () => ({
        status: "error",
        preview: uploadError.message || "Upload failed",
      }));
      pushToast({
        type: "error",
        title: "Upload failed",
        message: uploadError.message || "Document upload failed.",
      });
    }
  };

  const handleAskQuestion = async () => {
    if (!hasQuestion) {
      return;
    }

    try {
      await askQuestion();
      if (activeFileRecord) {
        updateRecord(activeFileRecord.id, () => ({
          status: "answered",
          lastOpenedAt: new Date().toISOString(),
          preview: `Last answered • ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
        }));
      }
      pushToast({ type: "success", title: "Answer ready", message: "Your grounded answer has been generated." });
    } catch (questionError) {
      pushToast({ type: "error", title: "Question failed", message: questionError.message || "Question answering failed." });
    }
  };

  const handleRename = () => {
    if (!activeFileRecord) {
      return;
    }

    const nextName = window.prompt("Rename this file", activeFileRecord.name);
    if (!nextName?.trim()) {
      return;
    }

    updateRecord(activeFileRecord.id, () => ({ name: nextName.trim() }));
    pushToast({ type: "success", title: "File renamed", message: `Saved as ${nextName.trim()}.` });
  };

  const handleArchive = () => {
    if (!activeFileRecord) {
      return;
    }

    updateRecord(activeFileRecord.id, () => ({ archived: true, status: "archived" }));
    setActiveLibraryId("");
    pushToast({ type: "info", title: "File archived", message: `${activeFileRecord.name} moved out of the active file list.` });
  };

  const handleDelete = () => {
    if (!activeFileRecord) {
      return;
    }

    setFileLibrary((current) => current.filter((item) => item.id !== activeFileRecord.id));
    setActiveLibraryId("");
    pushToast({ type: "info", title: "File removed", message: `${activeFileRecord.name} was removed from the recent file manager.` });
  };

  const handleTagToggle = (tag) => {
    if (!activeFileRecord) {
      return;
    }

    updateRecord(activeFileRecord.id, (item) => {
      const currentTags = item.tags || [];
      const tags = currentTags.includes(tag)
        ? currentTags.filter((entry) => entry !== tag)
        : [...currentTags, tag];
      return { tags };
    });
  };

  return (
    <div className="workspace-premium-shell">
      <section className="workspace-command-hero">
        <article className="workspace-hub-card workspace-command-story workspace-tool-premium-hero">
          <div className="workspace-command-topline">
            <div>
              <span className="workspace-command-kicker">Document Intelligence</span>
              <h3 className="workspace-command-title">Grounded document retrieval with a real file manager instead of a one-off upload slot.</h3>
              <p className="workspace-command-lede">
                Keep recent files visible, tag them by source, rename or archive them, and then ask focused questions against the active working document.
              </p>
            </div>
            <div className="workspace-chat-hero-pill">
              <span>Active files</span>
              <strong>{fileLibrary.filter((item) => !item.archived).length}</strong>
            </div>
          </div>

          <div className="workspace-command-badge-row">
            <article className="workspace-command-badge">
              <span>Accepted formats</span>
              <strong>PDF / TXT</strong>
              <p>Fast upload flow for document-centric retrieval.</p>
            </article>
            <article className="workspace-command-badge">
              <span>File manager</span>
              <strong>{activeFileRecord ? "Live" : "Ready"}</strong>
              <p>Recent files, metadata, source tags, rename, archive, and remove actions.</p>
            </article>
            <article className="workspace-command-badge">
              <span>Answer mode</span>
              <strong>{answer ? "Completed" : "Waiting"}</strong>
              <p>Sharper prompts return cleaner grounded extraction and fewer retries.</p>
            </article>
          </div>
        </article>

        <aside className="workspace-command-sidebar">
          <section className="workspace-hub-card workspace-spotlight-panel">
            <div className="workspace-spotlight-head">
              <span className="workspace-spotlight-tag">Active document</span>
            </div>
            <strong>{selectedFileName}</strong>
            <p>{activeFileRecord ? activeFileRecord.preview : "Select a PDF or TXT file to start document-grounded retrieval."}</p>
            <div className="workspace-focus-meta">
              <span>{fileExtension}</span>
              <span>{activeFileRecord?.status || "No upload yet"}</span>
            </div>
          </section>
        </aside>
      </section>

      <section className="workspace-command-main">
        <article className="workspace-hub-card workspace-tool-form-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">File manager</span>
              <h4>Load, review, and maintain your recent document sources</h4>
            </div>
            <span className="workspace-section-summary">Recent • tagged • archived</span>
          </div>

          <label className="upload-box workspace-premium-upload-box">
            <input type="file" accept=".pdf,.txt" onChange={handleFileSelection} />
            <span className="upload-icon">+</span>
            <strong>{selectedFile ? selectedFile.name : "Choose a document"}</strong>
            <small>Supported formats: PDF and TXT</small>
          </label>

          <div className="workspace-filter-strip">
            {[
              { id: "recent", label: "Recent files" },
              { id: "tagged", label: "Tagged" },
              { id: "archived", label: "Archived" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`workspace-filter-pill ${libraryFilter === item.id ? "is-active" : ""}`}
                onClick={() => setLibraryFilter(item.id)}
              >
                <span>{item.label}</span>
                <strong>
                  {item.id === "recent"
                    ? fileLibrary.filter((entry) => !entry.archived).length
                    : item.id === "tagged"
                      ? fileLibrary.filter((entry) => !entry.archived && (entry.tags || []).length > 0).length
                      : fileLibrary.filter((entry) => entry.archived).length}
                </strong>
              </button>
            ))}
          </div>

          <div className="workspace-focus-preview-list">
            {filteredLibrary.length > 0 ? (
              filteredLibrary.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`workspace-focus-preview-item workspace-card-button ${activeFileRecord?.id === item.id ? "is-active" : ""}`}
                  onClick={() => setActiveLibraryId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <p>{item.preview}</p>
                  <span>{formatTimestamp(item.lastOpenedAt)}</span>
                </button>
              ))
            ) : (
              <p className="workspace-collection-empty">
                {libraryFilter === "archived"
                  ? "Archived files will appear here."
                  : "No files in this view yet. Add one and the manager will keep it visible."}
              </p>
            )}
          </div>
        </article>

        <article className="workspace-hub-card workspace-tool-form-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">Selected file</span>
              <h4>Metadata, source tags, and quick actions</h4>
            </div>
            <span className="workspace-section-summary">Rename • archive • remove</span>
          </div>

          {activeFileRecord ? (
            <div className="workspace-form-stack">
              <div className="workspace-info-grid">
                <div className="workspace-mini-card">
                  <h4>File name</h4>
                  <p>{activeFileRecord.name}</p>
                </div>
                <div className="workspace-mini-card">
                  <h4>Size</h4>
                  <p>{formatFileSize(activeFileRecord.size)}</p>
                </div>
                <div className="workspace-mini-card">
                  <h4>Last opened</h4>
                  <p>{formatTimestamp(activeFileRecord.lastOpenedAt)}</p>
                </div>
                <div className="workspace-mini-card">
                  <h4>Source type</h4>
                  <p>{activeFileRecord.type}</p>
                </div>
              </div>

              <div className="workspace-filter-strip">
                {SOURCE_TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`workspace-filter-pill ${(activeFileRecord.tags || []).includes(tag) ? "is-active" : ""}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    <span>{tag}</span>
                  </button>
                ))}
              </div>

              <div className="workspace-hub-actions">
                <button className="hero-button hero-button-secondary" type="button" onClick={handleRename}>
                  Rename
                </button>
                <button className="hero-button hero-button-secondary" type="button" onClick={handleArchive}>
                  Archive
                </button>
                <button className="hero-button hero-button-secondary" type="button" onClick={handleDelete}>
                  Remove
                </button>
                <button className="hero-button hero-button-primary" type="button" onClick={handleUpload} disabled={!selectedFile || isUploading}>
                  {isUploading ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </div>
          ) : (
            <p className="workspace-collection-empty">Choose a file from the manager to review metadata and source tags.</p>
          )}
        </article>
      </section>

      <section className="workspace-command-main">
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

          <button className="hero-button hero-button-primary" onClick={handleAskQuestion} disabled={isAsking || !hasQuestion}>
            {isAsking ? "Generating..." : "Generate Answer"}
          </button>
        </article>

        <article className="workspace-hub-card workspace-tool-answer-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">Preview list</span>
              <h4>Recent file previews</h4>
            </div>
            <span className="workspace-section-summary">{fileLibrary.length} tracked</span>
          </div>

          <div className="workspace-collection-list">
            {fileLibrary.slice(0, 4).map((item) => (
              <div key={item.id} className="workspace-collection-item">
                <div className="workspace-collection-stack">
                  <strong>{item.name}</strong>
                  <p>{item.preview}</p>
                  <span className="workspace-collection-meta">{(item.tags || []).join(" • ") || "No source tags yet"}</span>
                </div>
                <span className="workspace-collection-timestamp">{formatTimestamp(item.uploadedAt)}</span>
              </div>
            ))}
            {fileLibrary.length === 0 ? (
              <p className="workspace-collection-empty">Recent previews will appear here after your first file is staged.</p>
            ) : null}
          </div>
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
            <p>Upload a document, ask a sharp question, and the grounded answer will appear here.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default DocumentRetrievalPanel;
