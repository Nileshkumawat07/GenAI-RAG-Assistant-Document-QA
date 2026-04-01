import React from "react";

function sanitizeAnswer(answer) {
  return answer
    .replace(/\r\n/g, "\n")
    .replace(/^\u2022\s*/gm, "- ")
    .replace(/\n(\d+)\.\s*\n(?=\S)/g, "\n$1. ")
    .replace(/[*_`#]+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function renderAnswer(answer) {
  const cleanedAnswer = sanitizeAnswer(answer);
  const lines = cleanedAnswer.split(/\r?\n/);
  const elements = [];
  let listItems = [];
  let key = 0;

  const flushList = () => {
    if (!listItems.length) {
      return;
    }

    elements.push(
      <ul key={`ul-${key++}`} className="answer-list">
        {listItems.map((item, index) => (
          <li key={`li-${key}-${index}`}>{item}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    if (/^[A-Za-z][A-Za-z0-9 /&()-]{0,50}:$/.test(line)) {
      flushList();
      elements.push(
        <h4 key={`h-${key++}`} className="answer-heading">
          {line.slice(0, -1)}
        </h4>
      );
      return;
    }

    if (/^[-]\s+/.test(line) || /^\u2022\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      listItems.push(line.replace(/^[-\u2022]\s+/, "").replace(/^\d+\.\s+/, ""));
      return;
    }

    flushList();
    elements.push(
      <p key={`p-${key++}`} className="answer-paragraph">
        {line}
      </p>
    );
  });

  flushList();

  return elements.length ? elements : <p className="answer-paragraph">{cleanedAnswer}</p>;
}
