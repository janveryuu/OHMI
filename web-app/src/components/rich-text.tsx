import { memo } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

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
          pre: ({ children }) => <pre tabIndex={0} aria-label="Code example">{children}</pre>,
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
