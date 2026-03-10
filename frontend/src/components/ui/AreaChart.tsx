import { useState, useRef, useCallback, useMemo } from 'react';

interface AreaChartProps {
  data: number[];
  labels?: string[];
  height?: number;
  tooltipPrefix?: string;
  tooltipSuffix?: string;
  labelInterval?: number;
}

const AreaChart = ({
  data,
  labels,
  height = 256,
  tooltipPrefix = '',
  tooltipSuffix = '',
  labelInterval = 0,
}: AreaChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; idx: number } | null>(null);

  const padTop = 20;
  const padBottom = 30;

  const maxVal = useMemo(() => Math.max(...data, 1), [data]);
  const chartH = height - padTop - padBottom;

  const buildPath = useCallback(
    (w: number) => {
      if (data.length === 0) return { line: '', area: '', points: [] as { x: number; y: number }[] };

      const n = data.length;
      const stepX = w / Math.max(n - 1, 1);

      const pts = data.map((v, i) => ({
        x: i * stepX,
        y: padTop + chartH - (v / maxVal) * chartH,
      }));

      const tension = 0.3;
      let d = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, pts.length - 1)];

        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;

        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
      }

      const areaBase = padTop + chartH;
      const area = `${d} L ${pts[pts.length - 1].x},${areaBase} L ${pts[0].x},${areaBase} Z`;

      return { line: d, area, points: pts };
    },
    [data, maxVal, chartH],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || data.length === 0) return;
      const rect = svg.getBoundingClientRect();
      const w = rect.width;
      const mouseX = e.clientX - rect.left;
      const n = data.length;
      const stepX = w / Math.max(n - 1, 1);
      let idx = Math.round(mouseX / stepX);
      idx = Math.max(0, Math.min(idx, n - 1));
      const pt = buildPath(w).points[idx];
      if (pt) setHover({ x: pt.x, y: pt.y, idx });
    },
    [data, buildPath],
  );

  const gridLines = 4;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = padTop + (chartH / gridLines) * i;
          return (
            <line
              key={i}
              x1="0"
              y1={y}
              x2="100%"
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              strokeDasharray="4 4"
            />
          );
        })}

        <AreaPath buildPath={buildPath} type="area" />
        <AreaPath buildPath={buildPath} type="line" />

        {hover && (
          <>
            <line
              x1={hover.x}
              y1={padTop}
              x2={hover.x}
              y2={padTop + chartH}
              stroke="hsl(var(--primary))"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.5}
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r={5}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      {labels && labels.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: padBottom - 4 }}>
          {labels.map((l, i) => {
            const show =
              labelInterval > 0
                ? i % labelInterval === 0
                : i === 0 ||
                  i === labels.length - 1 ||
                  (labels.length > 10 ? i % Math.ceil(labels.length / 6) === 0 : true);
            if (!show) return null;
            return (
              <span
                key={i}
                className="text-[9px] text-muted-foreground truncate absolute"
                style={{
                  left: `${(i / Math.max(labels.length - 1, 1)) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {l}
              </span>
            );
          })}
        </div>
      )}

      {hover !== null && (
        <div
          className="absolute bg-foreground text-background text-xs px-2.5 py-1 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-20"
          style={{
            left: hover.x,
            top: hover.y - 36,
            transform: 'translateX(-50%)',
          }}
        >
          {labels?.[hover.idx] ? `${labels[hover.idx]}: ` : ''}
          {tooltipPrefix}
          {typeof data[hover.idx] === 'number'
            ? data[hover.idx] % 1 !== 0
              ? data[hover.idx].toFixed(2)
              : data[hover.idx]
            : data[hover.idx]}
          {tooltipSuffix}
        </div>
      )}
    </div>
  );
};

const AreaPath = ({
  buildPath,
  type,
}: {
  buildPath: (w: number) => { line: string; area: string };
  type: 'area' | 'line';
}) => {
  const [pathD, setPathD] = useState('');

  const ref = useCallback(
    (node: SVGPathElement | null) => {
      if (!node) return;
      const svg = node.ownerSVGElement;
      if (!svg) return;
      const w = svg.getBoundingClientRect().width;
      const paths = buildPath(w);
      setPathD(type === 'area' ? paths.area : paths.line);

      const ro = new ResizeObserver(() => {
        const newW = svg.getBoundingClientRect().width;
        const np = buildPath(newW);
        setPathD(type === 'area' ? np.area : np.line);
      });
      ro.observe(svg);
    },
    [buildPath, type],
  );

  if (type === 'area') {
    return <path ref={ref} d={pathD} fill="url(#areaGrad)" />;
  }
  return (
    <path
      ref={ref}
      d={pathD}
      fill="none"
      stroke="hsl(var(--primary))"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
};

export default AreaChart;
