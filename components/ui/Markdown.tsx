import ReactMarkdown from "react-markdown";

/**
 * Markdown rendering styled for the Nécromant theme. react-markdown escapes
 * raw HTML by default, so user content is safe to render.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body font-nav text-sm leading-relaxed text-ink-soft">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
