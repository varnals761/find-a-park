import type { RefObject } from 'react';
import type { Park } from '../data/types';
import { parkHref } from '../lib/useHashRoute';

type Props = {
  parks: Park[];
  selectedId: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export function ParkList({ parks, selectedId, headingRef }: Props) {
  return (
    <>
      <h2 ref={headingRef} tabIndex={-1}>
        Parks ({parks.length})
      </h2>
      {parks.length === 0 ? (
        <p>No parks to show.</p>
      ) : (
        <ul className="park-list">
          {parks.map((park) => (
            <li key={park.id}>
              <a
                href={parkHref(park.id)}
                data-park-id={park.id}
                aria-current={park.id === selectedId ? 'page' : undefined}
              >
                {park.name}
              </a>
              {park.address !== undefined && <span className="address">{park.address}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
