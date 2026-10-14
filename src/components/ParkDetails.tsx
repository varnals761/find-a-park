import type { RefObject } from 'react';
import type { Park } from '../data/types';
import { amenityLabel } from '../lib/amenityLabel';
import { ParkImage } from './ParkImage';

type Props = { park: Park; headingRef: RefObject<HTMLHeadingElement | null> };

// Every field is optional: a row or section is rendered only when its value is
// present. Nothing is substituted for missing data.
export function ParkDetails({ park, headingRef }: Props) {
  const facts: { label: string; value: string }[] = [];
  if (park.address !== undefined) facts.push({ label: 'Address', value: park.address });
  if (park.hours !== undefined) facts.push({ label: 'Hours', value: park.hours });
  if (park.acreage !== undefined) facts.push({ label: 'Acreage', value: String(park.acreage) });
  if (park.rating !== undefined) facts.push({ label: 'Rating', value: String(park.rating) });

  return (
    <article>
      <h2 ref={headingRef} tabIndex={-1}>
        {park.name}
      </h2>

      {park.description !== undefined && <p>{park.description}</p>}

      {facts.length > 0 && (
        <dl className="facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {park.amenities.length > 0 && (
        <>
          <h3 id="amenities-heading">Amenities</h3>
          <ul aria-labelledby="amenities-heading" className="amenities">
            {park.amenities.map((slug) => (
              <li key={slug}>{amenityLabel(slug)}</li>
            ))}
          </ul>
        </>
      )}

      {park.images.length > 0 && (
        <>
          <h3>Photos</h3>
          <ul className="photos">
            {park.images.map((src, index) => (
              <li key={src}>
                <ParkImage
                  src={src}
                  alt={`${park.name}, photo ${index + 1} of ${park.images.length}`}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {park.coords === undefined && <p className="note">Not shown on the map.</p>}
    </article>
  );
}
