import { describe, expect, it } from 'vitest';
import { parseInlineMarkup, stripMarkup } from './inlineMarkup';

describe('parseInlineMarkup', () => {
  it('returns plain text unchanged', () => {
    expect(parseInlineMarkup('Prospect Park')).toEqual(['Prospect Park']);
  });

  it('returns nothing for an empty string', () => {
    expect(parseInlineMarkup('')).toEqual([]);
  });

  it('recognises <b> and <i>', () => {
    expect(parseInlineMarkup('<b>Bold</b> and <i>italic</i>')).toEqual([
      { tag: 'b', children: ['Bold'] },
      ' and ',
      { tag: 'i', children: ['italic'] },
    ]);
  });

  it('is case-insensitive and normalizes the tag name', () => {
    expect(parseInlineMarkup('<B>x</I>y</B>')).toEqual([
      { tag: 'b', children: ['x</I>y'] },
    ]);
  });

  it('allows nesting', () => {
    expect(parseInlineMarkup('<b>a <i>b</i> c</b>')).toEqual([
      { tag: 'b', children: ['a ', { tag: 'i', children: ['b'] }, ' c'] },
    ]);
  });

  it('keeps text around the tags in order', () => {
    expect(parseInlineMarkup('1400 <i>Example</i> St, Elizabeth, NJ')).toEqual([
      '1400 ',
      { tag: 'i', children: ['Example'] },
      ' St, Elizabeth, NJ',
    ]);
  });

  describe('everything else stays literal text', () => {
    it.each([
      ['script', "<script>alert('x')</script>Welcome"],
      ['img with handler', '<img src=x onerror="alert(1)">'],
      ['link', '<a href="https://evil.example">click</a>'],
      ['tag with attributes', '<b onclick="alert(1)">x</b>'],
      ['tag with a class', '<i class="x">x</i>'],
      ['self-closing', '<b/>'],
      ['spaces inside', '< b >x</ b >'],
      ['unsupported strong', '<strong>x</strong>'],
      ['comparison text', '5 < 6 and 7 > 3'],
    ])('%s', (_label, input) => {
      expect(parseInlineMarkup(input)).toEqual([input]);
    });
  });

  describe('unbalanced tags come back as the original text', () => {
    it.each([
      ['an unclosed opening tag', 'a <b>bold'],
      ['a stray closing tag', 'a</b> b'],
      ['mismatched nesting', '<b>x<i>y</b>z'],
      ['two unclosed tags', '<b><i>x'],
    ])('%s', (_label, input) => {
      expect(parseInlineMarkup(input)).toEqual([input]);
    });

    it('a balanced pair is still recognised next to an unbalanced one', () => {
      expect(parseInlineMarkup('<i>ok</i> then <b>open')).toEqual([
        { tag: 'i', children: ['ok'] },
        ' then <b>open',
      ]);
    });
  });
});

describe('stripMarkup', () => {
  it('removes recognised tags and keeps their text', () => {
    expect(stripMarkup('<b>Bold</b> Test Park')).toBe('Bold Test Park');
    expect(stripMarkup('1400 <i>Example</i> St')).toBe('1400 Example St');
  });

  it('keeps everything that is not a recognised tag', () => {
    expect(stripMarkup("<script>alert('x')</script>Welcome")).toBe(
      "<script>alert('x')</script>Welcome",
    );
  });

  it('leaves plain text alone', () => {
    expect(stripMarkup('Prospect Park')).toBe('Prospect Park');
  });
});
