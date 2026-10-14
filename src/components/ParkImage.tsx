import { useState } from 'react';

type Props = { src: string; alt: string };

// Image hosts can be down or (as in the sample data) not exist at all, so a
// failed load swaps in a visible text fallback instead of a broken icon.
export function ParkImage({ src, alt }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className="image-fallback">Image unavailable</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
