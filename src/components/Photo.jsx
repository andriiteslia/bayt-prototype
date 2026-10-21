import { useRef, useState } from 'react';
import HomeArt from './HomeArt.jsx';

// Sample interior photos (not of the fictional listings). Strong shots lead; close-ups only appear in galleries.
const HERO = [2, 6, 7, 8, 12, 13, 15, 16, 21, 23, 24, 26, 27];
const EXTRA = [1, 3, 5, 10];
const src = (n) => `${import.meta.env.BASE_URL}photos/p${n}.webp`;

// Which hero photo each listing gets. Chosen offline by running 360 typical searches and
// colouring listings so that homes shown together almost never share a photo.
const SLOT = {"sh1":1,"sh2":12,"dh1":7,"dh2":4,"dh3":5,"bb1":10,"bb2":8,"dt1":2,"dt2":6,"dt3":0,"jl1":3,"jl2":11,"jl3":12,"ab1":5,"ab2":3,"jv1":2,"jv2":3,"jv3":8,"dm1":1,"dm2":4,"mi1":7,"mi2":5,"af1":9,"cw1":9,"us1":11,"ts1":10,"ts2":0,"jl4":6};

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
