import { formatUsd } from "@/lib/format";

export interface ParetoPoint {
  modelId: string;
  displayName: string;
  avgCostUsd: number;
  /** null when this model had nothing to score against — such a point is listed
   * separately, never plotted at 0%, which would read as "got everything wrong". */
  correctnessPct: number | null;
  /** Jev isn't a Gemini model — drawn as a hollow ring instead of a filled dot
   * so it's identifiable without a second hue, but otherwise plotted exactly
   * like every other point: same axes, same scoring (golden answers only), no
   * special "reference line" treatment. */
  isJev?: boolean;
}

const WIDTH = 700;
const HEIGHT = 380;
const PAD = { top: 20, right: 28, bottom: 52, left: 52 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

/** Per-article costs are ~$0.000002, which makes for an unreadable axis — the
 * x scale is priced per 1,000 articles instead. */
const COST_SCALE = 1000;
const LABEL_MIN_GAP = 13;
/** Roughly the widest model name at 11px — used to decide which side of a mark
 * its label goes on. */
const LABEL_MAX_W = 120;

/** Cost vs. correctness for every Gemini model plus Jev, so the question "how
 * cheap can I go before it gets dumb" is answered by looking rather than by
 * arithmetic. Every point — Jev included — is scored the same way, against
 * the golden set only; nothing here is a "reference" the others are judged
 * against.
 *
 * One series (all points are the same kind of thing — a model), so identity is
 * carried by direct labels rather than by nine hues the rest of this app
 * doesn't have; Jev is distinguished by a hollow marker instead. */
export function SweepParetoChart({ points }: { points: ParetoPoint[] }) {
  const plotted = points.filter(
    (p): p is ParetoPoint & { correctnessPct: number } => p.correctnessPct !== null
  );
  const unplotted = points.filter((p) => p.correctnessPct === null);

  if (plotted.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        沒有黃金答案，無法繪製正確率圖表
      </p>
    );
  }

  const maxCost = Math.max(...plotted.map((p) => p.avgCostUsd * COST_SCALE)) * 1.12 || 1;

  const x = (costUsd: number) => PAD.left + (costUsd * COST_SCALE) / maxCost * PLOT_W;
  const y = (pct: number) => PAD.top + PLOT_H - (pct / 100) * PLOT_H;

  // Models cluster hard — several Flash tiers share a price, and correctness
  // ties are common — so labels are always dropped below the mark row and then
  // cascaded downwards. Sitting a label on its own dot's baseline would put it
  // straight under the next model's dot.
  const anchors = plotted.map((point) => ({
    point,
    cx: x(point.avgCostUsd),
    cy: y(point.correctnessPct),
  }));
  // Cascade away from whichever edge the marks sit nearest, so a cluster at the
  // bottom of the plot doesn't push its labels off the canvas.
  const goesDown =
    anchors.reduce((sum, a) => sum + a.cy, 0) / anchors.length < PAD.top + PLOT_H / 2;

  const labels = [...anchors]
    .sort((a, b) => (goesDown ? a.cy - b.cy : b.cy - a.cy) || a.cx - b.cx)
    .reduce<(typeof anchors[number] & { labelY: number })[]>((placed, entry) => {
      const previous = placed[placed.length - 1];
      const labelY = goesDown
        ? Math.max(entry.cy + LABEL_MIN_GAP, previous ? previous.labelY + LABEL_MIN_GAP : 0)
        : Math.min(
            entry.cy - LABEL_MIN_GAP,
            previous ? previous.labelY - LABEL_MIN_GAP : Number.POSITIVE_INFINITY
          );
      placed.push({ ...entry, labelY });
      return placed;
    }, []);

  const yTicks = [0, 25, 50, 75, 100];
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxCost);

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label="Jev 與各 Gemini 模型的平均成本與正確率散點圖"
      >
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--text-muted)"
            >
              {tick}%
            </text>
          </g>
        ))}

        {xTicks.map((tick, i) => (
          <text
            key={`x-${i}`}
            x={PAD.left + (tick / maxCost) * PLOT_W}
            y={HEIGHT - PAD.bottom + 18}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-muted)"
          >
            {tick === 0 ? "$0" : `$${tick.toFixed(tick < 1 ? 3 : 2)}`}
          </text>
        ))}

        <text
          x={PAD.left + PLOT_W / 2}
          y={HEIGHT - 10}
          textAnchor="middle"
          fontSize={11}
          fill="var(--text-muted)"
        >
          平均成本（每 1,000 篇）→ 越左越便宜
        </text>
        <text
          x={14}
          y={PAD.top + PLOT_H / 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--text-muted)"
          transform={`rotate(-90 14 ${PAD.top + PLOT_H / 2})`}
        >
          正確率 ↑ 越上越準
        </text>

        {labels.map(({ point, cx, cy, labelY }) => {
          // The priciest model sits near the right edge, where a label drawn
          // rightwards would run off the canvas — flip it to the other side.
          const flipped = cx > WIDTH - PAD.right - LABEL_MAX_W;
          return (
            <g key={point.modelId}>
              <title>
                {point.displayName}：正確率 {point.correctnessPct.toFixed(0)}%，
                平均 {formatUsd(point.avgCostUsd)} / 篇
              </title>
              <line
                x1={cx}
                y1={cy}
                x2={cx + (flipped ? -7 : 7)}
                y2={labelY}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <circle
                cx={cx}
                cy={cy}
                r={5}
                fill={point.isJev ? "var(--surface)" : "var(--accent)"}
                stroke={point.isJev ? "var(--accent)" : "var(--surface)"}
                strokeWidth={2}
              />
              <text
                x={cx + (flipped ? -10 : 10)}
                y={labelY + 4}
                textAnchor={flipped ? "end" : "start"}
                fontSize={11}
                fill="var(--text)"
                fontWeight={point.isJev ? 600 : 400}
              >
                {point.displayName}
              </text>
            </g>
          );
        })}
      </svg>

      {unplotted.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          未繪製（尚無正確性數據）：{unplotted.map((p) => p.displayName).join("、")}
        </p>
      )}
    </div>
  );
}
