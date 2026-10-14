import type { RefObject } from 'react';
import type { Park } from '../data/types';
import { stripMarkup } from '../lib/inlineMarkup';
import { parkHref } from '../lib/useHashRoute';
import { InlineMarkup } from './InlineMarkup';

type Props = {
  parks: Park[];
  selectedId: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Current query ("" or "?a=b"), kept on links so filters survive selection. */
  query?: string;
  emptyMessage?: string;
};

export function ParkList({
  parks,
  selectedId,
  headingRef,
  query = '',
  emptyMessage = 'No parks to show.',
}: Props) {
  return (
    <>
      <h2 id="park-list-heading" ref={headingRef} tabIndex={-1}>
        Parks ({parks.length})
      </h2>
      {parks.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        <ul className="park-list">
          {parks.map((park) => (
            <li key={park.id}>
              <a
                href={parkHref(park.id, query)}
                data-park-id={park.id}
                aria-current={park.id === selectedId ? 'page' : undefined}
                // The visible name is clamped to two lines; the full name is
                // always available to assistive technology and on hover.
                title={stripMarkup(park.name)}
              >
                <span className="park-name">
                  <InlineMarkup text={park.name} />
                </span>
              </a>
              {park.address !== undefined && (
                <span className="address">
                  <InlineMarkup text={park.address} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
