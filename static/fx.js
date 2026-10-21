(function(global) {
  const hexA = (hex, a) => { const h = hex.replace('#', ''); return `rgba(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',')},${a})`; };
  const enc = (svg) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  const rgb = (hex) => {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
  };

  const blotch = (color, fx, k, b, seed) => {
    const [r, g, bl] = rgb(color).split(' ');
    return enc(
      `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 400 200' preserveAspectRatio='none'>` +
        `<filter id='n' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='${fx}' numOctaves='3' seed='${seed}'/>` +
        `<feColorMatrix values='0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${bl}  ${k} 0 0 0 ${b}'/></filter>` +
        `<rect width='400' height='200' filter='url(#n)'/></svg>`
    );
  };

  const fxBackground = (fx, frame) => {
    const seed = fx.seed ?? 3;
    const drift = (fx.speed ?? 1) * (frame || 0);
    const layers = [], sizes = [], pos = [];
    const add = (l, size, p) => { layers.push(l); sizes.push(size); pos.push(p); };

    if (fx.kind === 'liquid') {
      const sx = 140 - ((drift * 0.8) % 280);
      add(`linear-gradient(110deg, transparent 0%, transparent 22%, ${hexA(fx.hi, 0.42)} 28%, transparent 36%, transparent 58%, ${hexA(fx.hi, 0.36)} 64%, transparent 72%, transparent 100%)`, '280% 100%', `${sx}% 0`);
      add(blotch(fx.hi, '0.006 0.011', 16, -9.1, seed), '170% 100%', `${-(drift * 0.3) % 100}% 0`);
      add(blotch(fx.lo, '0.008 0.015', 16, -8.7, seed + 7), '150% 100%', `${(drift * 0.22) % 100}% 0`);
      add(`linear-gradient(90deg, ${fx.stops.join(',')})`, '100% 100%', '0 0');
    } else if (fx.kind === 'flow') {
      const st = [...fx.stops, fx.stops[0]].join(',');
      add(`linear-gradient(105deg, transparent 0%, transparent 38%, ${hexA(fx.hi, 0.45)} 46%, transparent 54%, transparent 100%)`, '300% 100%', `${150 - ((drift * 1.1) % 300)}% 0`);
      add(`linear-gradient(90deg, ${st})`, '200% 100%', `${-((drift * 0.9) % 200)}% 0`);
    } else if (fx.kind === 'holo') {
      const st = (fx.stops.length > 2 ? fx.stops : ['#FF5EDF', '#FFE45E', '#5EFFB1', '#5EC8FF', '#B65EFF']);
      add(`linear-gradient(115deg, transparent 0%, transparent 40%, ${hexA(fx.hi, 0.8)} 48%, transparent 56%, transparent 100%)`, '300% 100%', `${150 - ((drift * 1.4) % 300)}% 0`);
      add(`linear-gradient(100deg, ${[...st, st[0]].join(',')})`, '220% 100%', `${-((drift * 1.2) % 220)}% 0`);
    } else if (fx.kind === 'chrome') {
      const [a, b, c, d] = fx.stops;
      add(`linear-gradient(105deg, transparent 0%, transparent 40%, ${hexA(fx.hi, 0.7)} 48%, transparent 56%, transparent 100%)`, '300% 100%', `${150 - ((drift * 0.8) % 300)}% 0`);
      add(`linear-gradient(180deg, ${a} 0%, ${b} 46%, ${c} 50%, ${d} 100%)`, '100% 100%', '0 0');
    } else {
      // grunge
      add(`linear-gradient(105deg, transparent 0%, transparent 40%, ${hexA(fx.hi, 0.35)} 48%, transparent 56%, transparent 100%)`, '300% 100%', `${150 - ((drift * 0.7) % 300)}% 0`);
      add(blotch(fx.hi, '0.012 0.02', 16, -9.3, seed), '150% 100%', `${-(drift * 0.2) % 100}% 0`);
      add(blotch(fx.lo, '0.012 0.02', 16, -8.95, seed + 5), '140% 100%', `${(drift * 0.15) % 100}% 0`);
      add(blotch(fx.lo, '0.3', 14, -8.9, seed + 9), '100% 100%', '0 0');
      add(`linear-gradient(180deg, ${fx.stops.join(',')})`, '100% 100%', '0 0');
    }

    return {
      backgroundImage: layers.join(','), backgroundSize: sizes.join(','), backgroundPosition: pos.join(','),
      backgroundRepeat: 'repeat-x', WebkitBackgroundClip: 'text', backgroundClip: 'text',
      color: 'transparent', WebkitTextFillColor: 'transparent',
    };
  };

  const FX = {
    teal:   { kind: 'liquid', stops: ['#2BD0C8', '#19A9AE', '#0C6E80', '#085A6C', '#0A6074', '#17A9B1', '#2CD2CB'], hi: '#43E3D8', lo: '#064654', speed: 1, seed: 4 },
    orange: { kind: 'grunge', stops: ['#FF6200', '#FF5A00', '#F04A06', '#D6300A'], hi: '#FF8A3A', lo: '#BE1A0A', speed: 1, seed: 8 },
  };

  global.blotch = blotch;
  global.fxBackground = fxBackground;
  global.FX = FX;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { blotch, fxBackground, FX };
  }
})(typeof window !== 'undefined' ? window : globalThis);
