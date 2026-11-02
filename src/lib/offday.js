// Off-day program: push-ups toward a daily goal, the inner-thigh routine, and activities.

// Inner-thigh routine. Weeks 1-2: 1 set, weeks 3-4: 2 sets, week 5+: 3 sets.
export const ADDUCTOR = [
  {
    name: 'Butterfly',
    targets: ['8-10', '10', '10+'],
    how: [
      'Sit tall with the soles of your feet together and knees out to the sides.',
      'Press down on your knees with your hands for resistance, then squeeze your knees up against your hands.',
      'Lower slowly and let your knees drop as far as they comfortably go. That is one rep.',
    ],
  },
  {
    name: 'Kozak',
    aka: 'Cossack squat',
    targets: ['4-5', '5', '5+'],
    how: [
      'Stand with your feet wide, toes turned out slightly.',
      'Shift your weight to one side and squat down on that leg. Keep the other leg straight with its toes pointing up.',
      'Keep your chest up and your heel down, go as low as you can control, then push back up. Do the reps on each side.',
    ],
  },
  {
    name: 'Straddle GM',
    aka: 'Straddle good morning',
    targets: ['6-10', '10', '10+'],
    how: [
      'Stand in a wide straddle with your toes forward and your knees soft. Hands on your hips or behind your head.',
      'Keep your back flat and hinge forward from your hips, pushing your hips back until you feel a stretch in your inner thighs and hamstrings.',
      'Squeeze your glutes and inner thighs to stand back up.',
    ],
  },
];

export const DEFAULT_ACTIVITIES = ['Snowboarding', 'Roller skating', 'Biking'];

// Local calendar date as YYYY-MM-DD (not UTC, so late-evening logs land on the right day).
export function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Week number of the inner-thigh routine on a date (1-based), or null before it starts.
export function adductorWeek(start, date) {
  if (!start) return null;
  const d = daysBetween(start, date);
  return d < 0 ? null : Math.floor(d / 7) + 1;
}

export function adductorPhase(week) {
  const idx = week <= 2 ? 0 : week <= 4 ? 1 : 2;
  return { idx, sets: idx + 1 };
}

// Most recent entry of a kind strictly before a date.
export function lastBefore(rows, kind, date) {
  let best = null;
  for (const r of rows) {
    if (r.kind === kind && r.date < date && (!best || r.date > best.date)) best = r;
  }
  return best;
}

// Monday-start week containing an ISO date.
export function weekStart(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Mon=0
  return addDays(iso, -dow);
}

export function prettyDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}
