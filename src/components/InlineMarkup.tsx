import { parseInlineMarkup, type MarkupNode } from '../lib/inlineMarkup';

function render(nodes: MarkupNode[]) {
  return nodes.map((node, index) => {
    if (typeof node === 'string') return node;
    const children = render(node.children);
    return node.tag === 'b' ? (
      <b key={index}>{children}</b>
    ) : (
      <i key={index}>{children}</i>
    );
  });
}

/** Renders text, honouring only plain <b> and <i>. See lib/inlineMarkup.ts. */
export function InlineMarkup({ text }: { text: string }) {
  return <>{render(parseInlineMarkup(text))}</>;
}
