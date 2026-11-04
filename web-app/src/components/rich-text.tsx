import { memo } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { CodeBlock } from "./code-block";

export const RichText = memo(function RichText({ text }: { text: string }) {
  return (
    <div className="rich-text">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              trust: false,
              strict: "ignore",
              throwOnError: false,
              maxExpand: 1000,
              maxSize: 20,
            },
          ],
        ]}
        components={{
          pre: ({ children }) => <div className="code-block-wrapper">{children}</div>,
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children || "").replace(/\n$/, "");
            const isBlock = Boolean(match) || codeString.includes("\n");

            if (isBlock) {
              return (
                <CodeBlock
                  code={codeString}
                  language={match ? match[1] : "arduino"}
                />
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          table: ({ children }) => <table tabIndex={0} aria-label="Data table">{children}</table>,
          span: ({ node: _node, className, ...props }) => <span {...props} className={className} tabIndex={className?.split(' ').includes('katex-display') ? 0 : undefined} />,
          img: () => null,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
});
