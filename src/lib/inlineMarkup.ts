// Park text is untrusted. The only markup we honour is a plain <b> or <i> (no
// attributes), which is turned into React elements by our own code. Nothing
// is ever passed to innerHTML, and anything else, including <script>, <img>,
// <a>, or a tag with attributes, stays literal text.

export type MarkupNode = string | { tag: 'b' | 'i'; children: MarkupNode[] };

type Frame = { tag: 'b' | 'i'; raw: string; children: MarkupNode[] };

// Exactly <b>, </b>, <i>, </i>: no spaces, no attributes, no self-closing.
const TAG = /<(\/?)(b|i)>/gi;

/**
 * Splits text into plain strings and <b>/<i> elements. Unbalanced or
 * mismatched tags are returned as the original text, so malformed input never
 * loses characters.
 */
export function parseInlineMarkup(input: string): MarkupNode[] {
  const root: MarkupNode[] = [];
  const stack: Frame[] = [];

  const currentList = (): MarkupNode[] => stack[stack.length - 1]?.children ?? root;

  const pushText = (text: string) => {
    if (text === '') return;
    const list = currentList();
    const last = list[list.length - 1];
    if (typeof last === 'string') list[list.length - 1] = last + text;
    else list.push(text);
  };

  let index = 0;
  for (const match of input.matchAll(TAG)) {
    pushText(input.slice(index, match.index));
    index = match.index + match[0].length;

    const closing = match[1] === '/';
    const tag = match[2]?.toLowerCase() === 'i' ? 'i' : 'b';

    if (!closing) {
      stack.push({ tag, raw: match[0], children: [] });
      continue;
    }
    const top = stack[stack.length - 1];
    if (top !== undefined && top.tag === tag) {
      stack.pop();
      currentList().push({ tag, children: top.children });
    } else {
      pushText(match[0]); // a closing tag with nothing to close
    }
  }
  pushText(input.slice(index));

  // Anything still open never closed: put it back as the text it was.
  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
    pushText(frame.raw);
    for (const child of frame.children) {
      if (typeof child === 'string') pushText(child);
      else currentList().push(child);
    }
  }

  return root;
}

function flatten(nodes: MarkupNode[]): string {
  return nodes.map((n) => (typeof n === 'string' ? n : flatten(n.children))).join('');
}

/** The text without <b>/<i> tags. For titles, announcements and labels. */
export function stripMarkup(input: string): string {
  return flatten(parseInlineMarkup(input));
}
