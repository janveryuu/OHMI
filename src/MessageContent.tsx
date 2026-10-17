import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MessageContentProps {
  content: string;
}

// Bounded normalization of legacy LaTeX delimiters \( ... \) and \[ ... \] outside code blocks
function normalizeMathDelimiters(text: string): string {
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return parts
    .map((part, index) => {
      // Odd indices are code fences or inline code; leave them untouched
      if (index % 2 === 1) return part;
      return part
        .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
        .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
    })
    .join('');
}

const ALLOWED_ELEMENTS = [
  'p', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'blockquote', 'a', 'span'
];

class MathErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return <span className="ohmi-math-error" style={{ color: 'var(--ohmi-muted)', fontStyle: 'italic', fontSize: '0.9em' }}>Formula could not be displayed; ask OHMI to restate it.</span>;
    }
    return this.props.children;
  }
}

export const MessageContent = memo(function MessageContent({ content }: MessageContentProps) {
  if (!content) return null;

  const normalized = normalizeMathDelimiters(content);

  return (
    <MathErrorBoundary>
      <div className="ohmi-message-markdown">
        <ReactMarkdown
          skipHtml={true}
          allowedElements={ALLOWED_ELEMENTS}
          remarkPlugins={[remarkMath]}
          rehypePlugins={[
            [
              rehypeKatex,
              {
                throwOnError: false,
                trust: false,
                maxSize: 50,
                maxExpand: 20
              }
            ]
          ]}
          components={{
            h1: ({ children }) => <h4>{children}</h4>,
            h2: ({ children }) => <h4>{children}</h4>,
            h3: ({ children }) => <h4>{children}</h4>,
            h4: ({ children }) => <h4 style={{ margin: '6px 0 4px', fontSize: '13px', fontWeight: 700 }}>{children}</h4>,
            h5: ({ children }) => <h5 style={{ margin: '4px 0 2px', fontSize: '12px', fontWeight: 700 }}>{children}</h5>,
            h6: ({ children }) => <h6 style={{ margin: '4px 0 2px', fontSize: '11px', fontWeight: 700 }}>{children}</h6>,
            p: ({ children }) => <p style={{ margin: '0 0 6px', lineHeight: 1.45 }}>{children}</p>,
            ul: ({ children }) => <ul style={{ paddingLeft: '18px', margin: '4px 0 6px' }}>{children}</ul>,
            ol: ({ children }) => <ol style={{ paddingLeft: '18px', margin: '4px 0 6px' }}>{children}</ol>,
            li: ({ children }) => <li style={{ marginBottom: '3px' }}>{children}</li>,
            a: ({ href, children }) => {
              if (href && /^https:\/\/[a-z0-9_.-]+/i.test(href) && !href.includes('@')) {
                return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{children}</a>;
              }
              return <span>{children}</span>;
            },
            pre: ({ children }) => (
              <pre className="ohmi-code-block" style={{ background: 'rgba(0,0,0,0.06)', padding: '6px 8px', borderRadius: '4px', overflowX: 'auto', fontSize: '0.85em', margin: '6px 0' }}>
                {children}
              </pre>
            ),
            code: ({ className, children, ...props }) => {
              const isInline = !className && typeof children === 'string' && !children.includes('\n');
              if (isInline) {
                return (
                  <code
                    style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: '3px', fontSize: '0.9em', fontFamily: 'monospace' }}
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code className={className} style={{ fontFamily: 'monospace' }} {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {normalized}
        </ReactMarkdown>
      </div>
    </MathErrorBoundary>
  );
});
