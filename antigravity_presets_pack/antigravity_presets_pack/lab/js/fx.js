const hexA = (hex, a) => { const h = hex.replace('#', ''); return `rgba(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',')},${a})`; };
const enc = (svg) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
const rgb = (hex) => {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
};
/** blotchy noise in ONE colour; k/b control how much of the area is covered (alpha = k*noise + b). */
export const blotch = (color, fx, k, b, seed) => {
    const [r, g, bl] = rgb(color).split(' ');
    return enc(`<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 400 200' preserveAspectRatio='none'>` +
        `<filter id='n' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='${fx}' numOctaves='3' seed='${seed}'/>` +
        `<feColorMatrix values='0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${bl}  ${k} 0 0 0 ${b}'/></filter>` +
        `<rect width='400' height='200' filter='url(#n)'/></svg>`);
};
/** returns the CSS background properties for a textured word. frame drives the slow texture drift + shine sweep. */
export const fxBackground = (fx, frame) => {
    const seed = fx.seed ?? 3;
    const drift = (fx.speed ?? 1) * frame;
    const layers = [], sizes = [], pos = [];
    const add = (l, size, p) => { layers.push(l); sizes.push(size); pos.push(p); };
    if (fx.kind === 'liquid') {
        // moving glossy swoosh (diagonal light band) - sweeps slowly across the word
        const sx = 120 - ((drift * 0.9) % 240);
        add(`linear-gradient(105deg, transparent 0%, transparent 30%, ${hexA(fx.hi, 0.7)} 38%, transparent 47%, transparent 100%)`, '260% 100%', `${sx}% 0`);
        add(blotch(fx.hi, '0.009 0.014', 4, -2.2, seed), '170% 100%', `${-(drift * 0.35) % 100}% 0`); // light liquid streaks
        add(blotch(fx.lo, '0.012 0.02', 4, -2.1, seed + 7), '150% 100%', `${(drift * 0.25) % 100}% 0`); // dark pools
        add(`linear-gradient(90deg, ${fx.stops.join(',')})`, '100% 100%', '0 0');
    }
    else {
        add(`linear-gradient(105deg, transparent 0%, transparent 40%, ${hexA(fx.hi, 0.55)} 48%, transparent 56%, transparent 100%)`, '300% 100%', `${150 - ((drift * 0.7) % 300)}% 0`);
        add(blotch(fx.hi, '0.01 0.016', 5, -2.75, seed), '150% 100%', `${-(drift * 0.2) % 100}% 0`); // light orange smears
        add(blotch(fx.lo, '0.014 0.022', 6, -2.9, seed + 5), '140% 100%', `${(drift * 0.15) % 100}% 0`); // dark red grunge
        add(blotch(fx.lo, '0.35', 3, -2.5, seed + 9), '100% 100%', '0 0'); // fine speckle
        add(`linear-gradient(180deg, ${fx.stops.join(',')})`, '100% 100%', '0 0');
    }
    return {
        backgroundImage: layers.join(','), backgroundSize: sizes.join(','), backgroundPosition: pos.join(','),
        backgroundRepeat: 'repeat-x', WebkitBackgroundClip: 'text', backgroundClip: 'text',
        color: 'transparent', WebkitTextFillColor: 'transparent',
    };
};
/** the 3 reference looks */
export const FX = {
    teal: { kind: 'liquid', stops: ['#27D6CC', '#12A3A8', '#0A6277', '#0A5A6E', '#0B6E80', '#1AB8BC', '#2BE0D2'], hi: '#6EFFEE', lo: '#06424F', speed: 1, seed: 4 },
    orange: { kind: 'grunge', stops: ['#FF8A00', '#FF6A00', '#EE4208', '#CC240A'], hi: '#FFB347', lo: '#A3130A', speed: 1, seed: 8 },
};
