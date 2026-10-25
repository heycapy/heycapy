import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { appHref } from "./chatLinks";

type Props = {
  content: string;
  appUrl: string | null;
};

const heading = "mt-2 mb-1 font-bold first:mt-0";

function chatComponents(appUrl: string | null): Components {
  return {
    p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
    h1: ({ children }) => <p className={`${heading} text-sm`}>{children}</p>,
    h2: ({ children }) => <p className={`${heading} text-sm`}>{children}</p>,
    h3: ({ children }) => <p className={heading}>{children}</p>,
    h4: ({ children }) => <p className={heading}>{children}</p>,
    h5: ({ children }) => <p className={heading}>{children}</p>,
    h6: ({ children }) => <p className={heading}>{children}</p>,
    ul: ({ children, className }) => (
      <ul
        className={
          className?.includes("contains-task-list")
            ? "mb-1.5 last:mb-0"
            : "mb-1.5 list-disc pl-3 last:mb-0"
        }
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => <ol className="mb-1.5 list-decimal pl-3 last:mb-0">{children}</ol>,
    li: ({ children }) => <li className="mb-0.5">{children}</li>,
    input: ({ checked }) => (
      <input type="checkbox" checked={!!checked} readOnly disabled className="mr-1 align-middle" />
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-border text-muted-foreground my-1.5 border-l-2 pl-2">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-border my-2" />,
    pre: ({ children }) => (
      <pre className="bg-muted my-1.5 overflow-x-auto rounded p-1.5 text-xs [&>code]:bg-transparent [&>code]:p-0">
        {children}
      </pre>
    ),
    code: ({ children }) => <code className="bg-muted rounded px-0.5">{children}</code>,
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="line-through">{children}</del>,
    table: ({ children }) => (
      <div className="my-1.5 max-w-full [scrollbar-width:thin] overflow-x-auto pb-1">
        <table className="border-collapse">{children}</table>
      </div>
    ),
    th: ({ children, style }) => (
      <th
        style={style}
        className="border-border bg-muted border px-2 py-1 text-left font-bold whitespace-nowrap"
      >
        {children}
      </th>
    ),
    td: ({ children, style }) => (
      <td
        style={style}
        className="border-border border px-2 py-1 align-top whitespace-nowrap first:min-w-[16ch] first:whitespace-normal"
      >
        {children}
      </td>
    ),
    img: ({ alt }) => (alt ? <>{alt}</> : null),
    a: ({ href, children }) => {
      const inApp = appHref(href, window.location.origin, appUrl);
      if (inApp) {
        return (
          <a href={inApp} className="underline underline-offset-2">
            {children}
          </a>
        );
      }
      const textSaysIt = typeof children === "string" && !!href?.includes(children);
      return (
        <>
          {children}
          {href && !textSaysIt && ` (${href})`}
        </>
      );
    },
  };
}

export function ChatMarkdown({ content, appUrl }: Props) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatComponents(appUrl)}>
      {content}
    </ReactMarkdown>
  );
}
