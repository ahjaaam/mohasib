"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Paragraphs
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,

        // Headings
        h1: ({ children }) => <h1 className="text-[14px] font-bold text-[#1A1A2E] mt-3 mb-1.5 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[13px] font-bold text-[#1A1A2E] mt-3 mb-1.5 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[12.5px] font-semibold text-[#1A1A2E] mt-2 mb-1 first:mt-0">{children}</h3>,

        // Lists
        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 pl-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 pl-1">{children}</ol>,
        li: ({ children }) => <li className="text-[12.5px] leading-snug">{children}</li>,

        // Bold / italic
        strong: ({ children }) => <strong className="font-semibold text-[#1A1A2E]">{children}</strong>,
        em: ({ children }) => <em className="italic text-[#6B7280]">{children}</em>,

        // Inline code
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <pre className="bg-[#F3F4F6] rounded-lg px-3 py-2.5 my-2 overflow-x-auto text-[11.5px] font-mono text-[#1A1A2E] border border-[rgba(0,0,0,0.07)]">
                <code>{children}</code>
              </pre>
            );
          }
          return (
            <code className="bg-[#F3F4F6] text-[#C8924A] px-1.5 py-0.5 rounded text-[11.5px] font-mono">
              {children}
            </code>
          );
        },

        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#C8924A] pl-3 my-2 text-[#6B7280] italic">
            {children}
          </blockquote>
        ),

        // Horizontal rule
        hr: () => <hr className="border-[rgba(0,0,0,0.1)] my-3" />,

        // Tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-[11.5px] border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-[#F3F4F6]">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-[rgba(0,0,0,0.06)]">{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => (
          <th className="text-left px-2.5 py-1.5 font-semibold text-[#1A1A2E] border border-[rgba(0,0,0,0.08)]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2.5 py-1.5 text-[#374151] border border-[rgba(0,0,0,0.06)]">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
