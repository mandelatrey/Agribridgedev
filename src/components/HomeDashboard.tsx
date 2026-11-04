import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowDownLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconMap2,
  IconPlant2,
  IconPlus,
  IconTrendingDown,
  IconTrendingUp,
  IconWallet,
} from "@tabler/icons-react";
import { date, label, number, ugx } from "../lib/format";
import {
  focusSeason,
  monthChange,
  monthlySales,
  seasonProgress,
} from "../lib/home-dashboard";
import type { Farm, Season, Transaction } from "../types";

const compactUgx = (value: number) =>
  new Intl.NumberFormat("en-UG", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
const monthName = (key: string, style: "short" | "long" = "short") =>
  new Intl.DateTimeFormat("en-UG", {
    month: style,
    timeZone: "UTC",
    ...(style === "long" ? { year: "numeric" } : {}),
  }).format(new Date(`${key}-01T00:00:00Z`));

/** Season progress between planting and expected harvest, as a half gauge. */
export function SeasonOverview({
  seasons,
  farmId,
  today,
}: {
  seasons: Season[];
  farmId: string;
  today: string;
}) {
  const season = focusSeason(seasons, farmId);
  const link = farmId
    ? `/seasons?farm=${encodeURIComponent(farmId)}`
    : "/seasons";
  if (!season)
    return (
      <section className="home-card home-season" aria-label="Season overview">
        <div className="home-card-head">
          <h2>Season overview</h2>
        </div>
        <div className="home-season-empty">
          <IconPlant2 size={30} stroke={1.4} aria-hidden="true" />
          <strong>Good harvests start with a plan.</strong>
          <p>Bring your crop calendar, costs and harvest goals together.</p>
          <Link className="button button-secondary" to={link}>
            Plan your season <IconArrowRight size={16} />
          </Link>
        </div>
      </section>
    );
  const progress = seasonProgress(season, today);
  // Half circle from left (180°) to right (0°), radius 80, centred at (100,100).
  const arc = (ratio: number) => {
    const angle = Math.PI * (1 - ratio);
    return `M 20 100 A 80 80 0 0 1 ${100 + 80 * Math.cos(angle)} ${100 - 80 * Math.sin(angle)}`;
  };
  const percent = Math.round(progress.ratio * 100);
  return (
    <section className="home-card home-season" aria-labelledby="season-title">
      <div className="home-card-head">
        <h2 id="season-title">Season overview</h2>
        <Link className="text-link" to={link}>
          Open <IconArrowUpRight size={15} />
        </Link>
      </div>
      <div className="home-gauge">
        <svg
          viewBox="0 0 200 112"
          role="img"
          aria-label={`${season.name}: ${percent}% of the way from planting to expected harvest`}
        >
          <path className="home-gauge-track" d={arc(1)} />
          {progress.ratio > 0 && (
            <path className="home-gauge-value" d={arc(progress.ratio)} />
          )}
        </svg>
        <div className="home-gauge-reading">
          <strong>
            {season.status === "planning"
              ? "Planning"
              : `Day ${progress.elapsedDays}`}
          </strong>
          <small>
            {season.status === "planning"
              ? `${progress.totalDays}-day season`
              : progress.daysLeft > 0
                ? `of ${progress.totalDays} · ${progress.daysLeft} days to harvest`
                : `of ${progress.totalDays} · harvest date reached`}
          </small>
        </div>
      </div>
      <p className="home-season-name">
        {season.name} · {season.crop}
      </p>
      <dl className="home-season-facts">
        <div>
          <dt>Planted</dt>
          <dd>{date(season.plantingDate)}</dd>
        </div>
        <div>
          <dt>Harvest due</dt>
          <dd>{date(season.expectedHarvestDate)}</dd>
        </div>
        <div>
          <dt>Harvested</dt>
          <dd>
            {number(season.harvestedKg)} / {number(season.expectedHarvestKg)} kg
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function LandStat({ farms }: { farms: Farm[] }) {
  const acres = farms.reduce((sum, farm) => sum + farm.areaAcres, 0);
  return (
    <Link className="home-card home-stat" to="/farms">
      <span className="home-stat-label">
        Land area
        <span className="home-stat-icon">
          <IconMap2 size={18} aria-hidden="true" />
        </span>
      </span>
      <strong>{number(acres)} acres</strong>
      <small>
        {farms.length === 1
          ? `${farms[0].name} · ${farms[0].crop}`
          : `Across ${farms.length} farms`}
      </small>
    </Link>
  );
}

export function SalesStat({
  transactions,
  today,
}: {
  transactions: Transaction[];
  today: string;
}) {
  const [previous, current] = monthlySales(transactions, today, 2);
  const change = monthChange(current.totalUgx, previous.totalUgx);
  return (
    <Link className="home-card home-stat" to="/transactions">
      <span className="home-stat-label">
        Sales this month
        <span className="home-stat-icon">
          <IconWallet size={18} aria-hidden="true" />
        </span>
      </span>
      <strong>{ugx(current.totalUgx)}</strong>
      <small className="home-stat-change">
        {change === null ? (
          "No sales recorded last month to compare"
        ) : (
          <>
            {change >= 0 ? (
              <IconTrendingUp size={15} aria-hidden="true" />
            ) : (
              <IconTrendingDown size={15} aria-hidden="true" />
            )}
            {change >= 0 ? "+" : ""}
            {change}% from last month
          </>
        )}
      </small>
    </Link>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Recorded sales by month: one series, a crosshair and a tooltip on hover. */
export function SalesChart({
  transactions,
  today,
}: {
  transactions: Transaction[];
  today: string;
}) {
  const months = monthlySales(transactions, today, 6);
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const height = 210;
  const pad = { top: 16, right: 12, bottom: 28, left: 44 };
  const plotWidth = Math.max(0, width - pad.left - pad.right);
  const plotHeight = height - pad.top - pad.bottom;
  const peak = Math.max(...months.map((item) => item.totalUgx));
  const step = niceStep(peak / 3 || 1);
  const tickCount = Math.max(1, Math.ceil(peak / step));
  const top = step * tickCount;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => index);
  const x = (index: number) =>
    pad.left + (plotWidth * index) / Math.max(1, months.length - 1);
  const y = (value: number) => pad.top + plotHeight * (1 - value / top);
  const points = months.map((item, index) => [x(index), y(item.totalUgx)]);
  const line = points.map(([px, py]) => `${px},${py}`).join(" ");
  const area = `${pad.left},${y(0)} ${line} ${x(months.length - 1)},${y(0)}`;
  const hasSales = peak > 0;
  const shown = active ?? null;
  return (
    <section className="home-card home-chart" aria-labelledby="sales-title">
      <div className="home-card-head">
        <div>
          <h2 id="sales-title">Monthly sales</h2>
          <small>Recorded sales, last 6 months</small>
        </div>
        <Link className="text-link" to="/transactions">
          Transactions <IconArrowUpRight size={15} />
        </Link>
      </div>
      <div className="home-chart-plot" ref={ref}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            aria-hidden="true"
            onPointerLeave={() => setActive(null)}
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const relative = event.clientX - box.left - pad.left;
              const index = Math.round(
                (relative / Math.max(1, plotWidth)) * (months.length - 1),
              );
              setActive(Math.min(months.length - 1, Math.max(0, index)));
            }}
          >
            <defs>
              <linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2f7a52" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#2f7a52" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  className="home-chart-grid"
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(step * tick)}
                  y2={y(step * tick)}
                />
                <text
                  className="home-chart-axis"
                  x={pad.left - 8}
                  y={y(step * tick) + 4}
                  textAnchor="end"
                >
                  {compactUgx(step * tick)}
                </text>
              </g>
            ))}
            {months.map((item, index) => (
              <text
                key={item.month}
                className="home-chart-axis"
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
              >
                {monthName(item.month)}
              </text>
            ))}
            {hasSales && (
              <>
                <polygon points={area} fill="url(#sales-fill)" />
                <polyline className="home-chart-line" points={line} />
              </>
            )}
            {shown !== null && (
              <line
                className="home-chart-crosshair"
                x1={x(shown)}
                x2={x(shown)}
                y1={pad.top}
                y2={y(0)}
              />
            )}
            {hasSales &&
              points.map(([px, py], index) => (
                <circle
                  key={months[index].month}
                  className="home-chart-point"
                  cx={px}
                  cy={py}
                  r={index === shown ? 6 : 4}
                />
              ))}
          </svg>
        )}
        {shown !== null && width > 0 && (
          <div
            className="home-chart-tooltip"
            style={{
              left: Math.min(Math.max(x(shown), 70), width - 70),
              top: Math.max(0, y(months[shown].totalUgx) - 66),
            }}
          >
            <small>{monthName(months[shown].month, "long")}</small>
            <strong>{ugx(months[shown].totalUgx)}</strong>
          </div>
        )}
        {!hasSales && (
          <p className="home-chart-empty">
            No sales recorded in the last 6 months.{" "}
            <Link to="/transactions">Record a sale</Link>
          </p>
        )}
      </div>
      <table className="sr-only">
        <caption>Recorded sales by month</caption>
        <tbody>
          {months.map((item) => (
            <tr key={item.month}>
              <th scope="row">{monthName(item.month, "long")}</th>
              <td>{ugx(item.totalUgx)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  return (
    (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power
  );
}

export function FarmSpotlight({
  farm,
  onAddFarm,
}: {
  farm?: Farm;
  onAddFarm: () => void;
}) {
  return (
    <section className="home-spotlight" aria-label="Farm spotlight">
      <img
        src="/images/agribridge-fields-1024.webp"
        srcSet="/images/agribridge-fields-640.webp 640w, /images/agribridge-fields-1024.webp 1024w, /images/agribridge-fields-1536.webp 1536w"
        sizes="(max-width: 960px) 100vw, 40vw"
        alt=""
        loading="lazy"
      />
      <div className="home-spotlight-panel">
        {farm ? (
          <>
            <div className="home-spotlight-head">
              <strong>{farm.name}</strong>
              <Link className="text-link" to="/farms">
                Farm details <IconArrowRight size={15} />
              </Link>
            </div>
            <dl>
              <div>
                <dt>Stage</dt>
                <dd>{label(farm.stage)}</dd>
              </div>
              <div>
                <dt>Planted</dt>
                <dd>{date(farm.plantedAt)}</dd>
              </div>
              <div>
                <dt>Crop</dt>
                <dd>
                  {farm.crop} · {number(farm.areaAcres)} ac
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="home-spotlight-head">
            <strong>Start with your first farm.</strong>
            <button className="text-link" onClick={onAddFarm}>
              <IconPlus size={15} /> Add a farm
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function RecentTransactions({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const recent = [...transactions]
    .sort(
      (a, b) =>
        b.transactionDate.localeCompare(a.transactionDate) ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, 5);
  return (
    <section className="home-card home-recent" aria-labelledby="recent-title">
      <div className="home-card-head">
        <h2 id="recent-title">Recent transactions</h2>
        <Link className="text-link" to="/transactions">
          View all <IconArrowUpRight size={15} />
        </Link>
      </div>
      {recent.length ? (
        <ul>
          {recent.map((item) => (
            <li key={item.id}>
              <span
                className={`home-recent-icon ${item.kind === "sell" ? "is-sale" : "is-purchase"}`}
              >
                {item.kind === "sell" ? (
                  <IconArrowUpRight size={17} aria-hidden="true" />
                ) : (
                  <IconArrowDownLeft size={17} aria-hidden="true" />
                )}
              </span>
              <span className="home-recent-copy">
                <strong>{item.crop}</strong>
                <small>
                  {item.kind === "sell" ? "Sold to" : "Bought from"}{" "}
                  {item.kind === "sell" ? item.buyer : item.seller} ·{" "}
                  {date(item.transactionDate)}
                </small>
              </span>
              <span className="home-recent-amount">
                <strong>{ugx(item.totalUgx)}</strong>
                <small>{number(item.quantityKg)} kg</small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-recent-empty">
          No sales or purchases yet.{" "}
          <Link to="/transactions">Record a transaction</Link>
        </p>
      )}
    </section>
  );
}
