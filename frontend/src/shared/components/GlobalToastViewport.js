import React from "react";

function GlobalToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="global-toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <article key={toast.id} className={`global-toast-card is-${toast.type || "info"}`}>
          <div>
            <strong>{toast.title || "Workspace update"}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" className="global-toast-dismiss" onClick={() => onDismiss(toast.id)}>
            Dismiss
          </button>
        </article>
      ))}
    </div>
  );
}

export default GlobalToastViewport;
