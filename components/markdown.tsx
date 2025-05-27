import Link from 'next/link';
import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './code-block';
import { CitationMarker } from './citation-marker';

const components: Partial<Components> = {
  // @ts-expect-error
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-1" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      // @ts-expect-error
      <Link
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        {children}
      </h6>
    );
  },
};

const remarkPlugins = [remarkGfm];

interface MarkdownProps {
  children: string;
  onCitationClick?: (citationNumber: number) => void;
}

// Helper function to process text and replace citations
const processTextWithCitations = (
  text: string,
  onCitationClick?: (citationNumber: number) => void,
  keyPrefix: string = ''
): React.ReactNode[] => {
  const parts = text.split(/(\[CIT\d+\])/g);
  
  return parts.map((part, index) => {
    const citationMatch = part.match(/\[CIT(\d+)\]/);
    if (citationMatch) {
      const citationNumber = parseInt(citationMatch[1], 10);
      return (
        <CitationMarker
          key={`${keyPrefix}-citation-${index}-${citationNumber}`}
          number={citationNumber}
          onClick={() => onCitationClick?.(citationNumber)}
        />
      );
    }
    // Return text with a key to avoid React warnings
    return <React.Fragment key={`${keyPrefix}-text-${index}`}>{part}</React.Fragment>;
  });
};

const NonMemoizedMarkdown = ({ children, onCitationClick }: MarkdownProps) => {
  const componentsWithCitations: Partial<Components> = {
    ...components,
    // Override text rendering to handle citations
    p: ({ node, children, ...props }) => {
      const processedChildren = React.Children.map(children, (child, childIndex) => {
        if (typeof child === 'string') {
          return processTextWithCitations(child, onCitationClick, `p-${childIndex}`);
        }
        return child;
      });

      return <p {...props}>{processedChildren}</p>;
    },
    // Also handle citations in list items
    li: ({ node, children, ...props }) => {
      const processedChildren = React.Children.map(children, (child, childIndex) => {
        if (typeof child === 'string') {
          return processTextWithCitations(child, onCitationClick, `li-${childIndex}`);
        }
        return child;
      });

      return <li className="py-1" {...props}>{processedChildren}</li>;
    },
    // Handle citations in other text containers
    strong: ({ node, children, ...props }) => {
      const processedChildren = React.Children.map(children, (child, childIndex) => {
        if (typeof child === 'string') {
          return processTextWithCitations(child, onCitationClick, `strong-${childIndex}`);
        }
        return child;
      });

      return <span className="font-semibold" {...props}>{processedChildren}</span>;
    },
    em: ({ node, children, ...props }) => {
      const processedChildren = React.Children.map(children, (child, childIndex) => {
        if (typeof child === 'string') {
          return processTextWithCitations(child, onCitationClick, `em-${childIndex}`);
        }
        return child;
      });

      return <em {...props}>{processedChildren}</em>;
    },
  };

  return (
    <ReactMarkdown 
      remarkPlugins={remarkPlugins} 
      components={componentsWithCitations}
    >
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children && prevProps.onCitationClick === nextProps.onCitationClick,
);
