import { Fragment } from "react";
// Deliberately small safe renderer for trusted preset copy; user text never becomes HTML.
export function RichText({ text }: { text: string }) {
  return (
    <div className="rich-text">
      {text.split(/(```[\s\S]*?```)/g).map((part, i) =>
        part.startsWith("```") ? (
          <pre key={i}>
            <code>{part.replace(/^```\w*\n?/, "").replace(/```$/, "")}</code>
          </pre>
        ) : (
          <Fragment key={i}>
            {part.split("\n\n").map((paragraph, j) => (
              <p key={j}>
                {paragraph
                  .split(/(\*\*.*?\*\*|`.*?`)/g)
                  .map((bit, k) =>
                    bit.startsWith("**") ? (
                      <strong key={k}>{bit.slice(2, -2)}</strong>
                    ) : bit.startsWith("`") ? (
                      <code key={k}>{bit.slice(1, -1)}</code>
                    ) : (
                      bit
                    ),
                  )}
              </p>
            ))}
          </Fragment>
        ),
      )}
    </div>
  );
}
