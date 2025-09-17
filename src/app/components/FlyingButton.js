import { useRef } from 'react';

export default function FlyingButton({
  children,
  src,
  targetTop = '5%',
  targetLeft = '95%',
  duration = 700,
  size = 48,
  onComplete,
}) {
  const ref = useRef(null);

  function toPx(v, total) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.endsWith('%')) return (parseFloat(v) / 100) * total;
    return parseFloat(v || 0);
  }

  function animateFly() {
    if (!ref.current || !src) return;

    const start = ref.current.getBoundingClientRect();
    const img = document.createElement('img');
    img.src = src;
    Object.assign(img.style, {
      position: 'fixed',
      left: `${start.left + start.width / 2 - size / 2}px`,
      top: `${start.top + start.height / 2 - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '8px',
      pointerEvents: 'none',
      zIndex: 9999,
    });
    document.body.appendChild(img);

    const endX = toPx(targetLeft, window.innerWidth);
    const endY = toPx(targetTop, window.innerHeight);
    const dx = endX - (start.left + start.width / 2);
    const dy = endY - (start.top + start.height / 2);

    const anim = img.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0.2 },
      ],
      { duration, easing: 'cubic-bezier(.22,.61,.36,1)' }
    );
    anim.addEventListener('finish', () => {
      img.remove();
      onComplete && onComplete();
    });
  }

  // Click anywhere inside to trigger the fly effect (and let inner onClick still run)
  const onClickCapture = () => animateFly();

  return (
    <div ref={ref} onClickCapture={onClickCapture} className="flying-button-parent">
      {children}
    </div>
  );
}
