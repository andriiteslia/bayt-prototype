import { useRef, useState } from 'react';
import HomeArt from './HomeArt.jsx';

// Sample interior photos (not of the fictional listings). Strong shots lead; close-ups only appear in galleries.
const HERO = [2, 6, 7, 8, 12, 13, 15, 16, 21, 23, 24, 26, 27];
const EXTRA = [1, 3, 5, 10];
const src = (n) => `${import.meta.env.BASE_URL}photos/p${n}.webp`;

// Which hero photo each listing gets. Chosen offline by running 420 typical searches and
// colouring listings so that homes shown together almost never share a photo.
const SLOT = {"sh1":9,"sh2":0,"sh3":12,"dh1":6,"dh2":9,"dh3":5,"bb1":1,"bb2":7,"dt1":3,"dt2":7,"dt3":2,"jl1":11,"jl2":6,"jl3":0,"ab1":5,"ab2":5,"jv1":3,"jv2":11,"jv3":6,"dm1":12,"dm2":9,"mi1":8,"mi2":8,"af1":10,"cw1":10,"us1":4,"us2":7,"ts1":1,"ts2":2,"jl4":4};

export function photosFor(listing) {
  const k = SLOT[listing.id] ?? 0;
  return [src(HERO[k]), src(HERO[(k + 5) % HERO.length]), src(EXTRA[k % EXTRA.length])];
}

export function Photo({ listing, height, className = '', index = 0 }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <HomeArt listing={listing} height={height} rounded={false} />;
  return (
    <img className={`photo ${className}`} src={photosFor(listing)[index]} alt={`Sample photo for ${listing.building}`}
      style={{ height }} loading="lazy" decoding="async" onError={() => setFailed(true)} />
  );
}

export function Gallery({ listing, height }) {
  const [i, setI] = useState(0);
  const ref = useRef(null);
  const photos = photosFor(listing);
  return (
    <div className="gallery">
      <div className="gallery-track" ref={ref} style={{ height }}
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {photos.map((_, n) => <Photo key={n} listing={listing} index={n} height={height} />)}
      </div>
      <span className="gallery-count">{i + 1} / {photos.length}</span>
    </div>
  );
}
