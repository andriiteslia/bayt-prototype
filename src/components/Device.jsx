import { useLayoutEffect, useRef } from 'react';
import { getSvgPath } from 'figma-squircle';

// Phone frame shown on wider screens: black bezel, screen corners with 60% smoothing
// (the iOS-style superellipse, same maths as Figma's corner smoothing).
// On a real phone the frame disappears and the app fills the screen.
const DESKTOP = '(min-width: 600px)';
const BEZEL = 11;
const OUTER_R = 62;
const SMOOTH = 0.6;

function clip(el, r) {
  const { width, height } = el.getBoundingClientRect();
  if (!width || !height) return;
  el.style.clipPath = `path('${getSvgPath({ width, height, cornerRadius: r, cornerSmoothing: SMOOTH })}')`;
}

export default function Device({ children }) {
  const frame = useRef(null);
  const screen = useRef(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const apply = () => {
      if (!frame.current || !screen.current) return;
      if (mq.matches) {
        clip(frame.current, OUTER_R);
        clip(screen.current, OUTER_R - BEZEL);
      } else {
        frame.current.style.clipPath = '';
        screen.current.style.clipPath = '';
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(frame.current);
    mq.addEventListener('change', apply);
    return () => { ro.disconnect(); mq.removeEventListener('change', apply); };
  }, []);

  return (
    <div className="device-shadow">
      <div className="device" ref={frame}>
        <div className="phone" ref={screen}>
          {children}
          <span className="island" aria-hidden />
        </div>
      </div>
    </div>
  );
}
