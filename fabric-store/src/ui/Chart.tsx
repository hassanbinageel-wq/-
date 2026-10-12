import { useMemo, useRef, useState } from 'react';
import { fmtMoney, fmtNum } from '../lib/format';

export interface Series {
  name: string;
  color: string; // متغير CSS
}
export interface Bucket {
  label: string;
  full: string;
  values: number[];
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

function short(v: number) {
  const a = Math.abs(v);
  if (a >= 1e9) return fmtNum(v / 1e9, 1) + 'B';
  if (a >= 1e6) return fmtNum(v / 1e6, 1) + 'M';
  if (a >= 1e3) return fmtNum(v / 1e3, 1) + 'K';
  return fmtNum(v, 0);
}

/** أعمدة مجمّعة بمحور واحد، مع تلميح عند اللمس/المرور ووسيلة إيضاح */
export function BarChart({ buckets, series, height = 220 }: { buckets: Bucket[]; series: Series[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const W = 640;
  const H = height;
  const padL = 8;
  const padR = 46;
  const padT = 10;
  const padB = 26;
  const { max, min } = useMemo(() => {
    const all = buckets.flatMap((b) => b.values);
    return { max: niceMax(Math.max(0, ...all)), min: Math.min(0, ...all) < 0 ? -niceMax(-Math.min(0, ...all)) : 0 };
  }, [buckets]);
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const y = (v: number) => padT + ((max - v) / (max - min || 1)) * plotH;
  const bw = plotW / Math.max(1, buckets.length);
  const groupW = Math.min(bw * 0.72, 44);
  const barW = Math.max(3, (groupW - (series.length - 1) * 2) / series.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
  const labelEvery = Math.ceil(buckets.length / 8);

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <div className="legend" style={{ marginBottom: 8 }}>
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(' و ')}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="grid-line" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text className="axis-label" x={W - padR + 6} y={y(t) + 4} textAnchor="start">
              {short(t)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const cx = padL + bw * i + bw / 2;
          const x0 = cx - groupW / 2;
          return (
            <g key={i}>
              {hover === i && <rect x={padL + bw * i} y={padT} width={bw} height={plotH} fill="var(--primary-soft)" opacity={0.6} />}
              {b.values.map((v, si) => {
                const top = y(Math.max(0, v));
                const h = Math.abs(y(v) - y(0));
                const x = x0 + si * (barW + 2);
                const r = Math.min(4, barW / 2, h);
                return h > 0 ? (
                  <path
                    key={si}
                    fill={series[si].color}
                    d={
                      v >= 0
                        ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`
                        : `M${x},${y(0)} V${y(v) - r} Q${x},${y(v)} ${x + r},${y(v)} H${x + barW - r} Q${x + barW},${y(v)} ${x + barW},${y(v) - r} V${y(0)} Z`
                    }
                  />
                ) : null;
              })}
              {i % labelEvery === 0 && (
                <text className="axis-label" x={cx} y={H - 6} textAnchor="middle">
                  {b.label}
                </text>
              )}
              <rect
                x={padL + bw * i}
                y={0}
                width={bw}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>
      {hover != null && buckets[hover] && (
        <div
          className="chart-tip"
          style={{
            top: 30,
            left: `${Math.min(80, Math.max(20, ((padL + bw * hover + bw / 2) / W) * 100))}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bold" style={{ marginBottom: 4 }}>{buckets[hover].full}</div>
          {series.map((s, si) => (
            <div key={s.name} className="row between" style={{ gap: 12 }}>
              <span>
                <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: s.color, marginInlineEnd: 6 }} />
                {s.name}
              </span>
              <span className="num bold">{fmtMoney(buckets[hover].values[si])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
