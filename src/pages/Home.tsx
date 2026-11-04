import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconCheck,
  IconChecks,
  IconPlus,
  IconSeedling,
  IconUsers,
} from "@tabler/icons-react";
import { useApp } from "../context/AppContext";
import { Button, Notice, Skeleton } from "../components/ui";
import { date, dueLabel, label, number, today } from "../lib/format";
import { agendaTasks, type AgendaFilter } from "../lib/workspace";
import { FarmEditor, TaskEditor } from "./Farms";
import { HomeWeather } from "../components/HomeData";
import {
  FarmSpotlight,
  LandStat,
  RecentTransactions,
  SalesChart,
  SalesStat,
  SeasonOverview,
} from "../components/HomeDashboard";
import { WorkspaceJourney } from "../components/WorkspaceGuide";
import { useActiveFarm } from "../lib/active-farm";
import type { Task } from "../types";
import "../styles/home-journey.css";
import "../styles/home-dashboard.css";

const filters: { id: AgendaFilter; label: string }[] = [
  { id: "pending", label: "All pending" },
  { id: "today", label: "Today" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Completed" },
];
export default function Home() {
  const { user } = useApp();
  return <WorkspaceHome key={`${user?.organizationId}:${user?.id}`} />;
}
function WorkspaceHome() {
  const {
    data,
    user,
    queue,
    mutate,
    loading,
    lastSync,
    online,
    error: workspaceError,
    refresh,
  } = useApp();
  const [editor, setEditor] = useState<"farm" | "task" | null>(null);
  const [staffFarmId, setFarmId] = useState("");
  const [filter, setFilter] = useState<AgendaFilter>("pending");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [day, setDay] = useState(today);
  useEffect(() => {
    const timer = window.setInterval(() => setDay(today()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const staff = user?.role === "admin" || user?.role === "operator";
  const activeFarm = useActiveFarm(user?.id, data.farms);
  // Farmers work on the farm chosen in the sidebar; staff filter here.
  const farmId = staff ? staffFarmId : (activeFarm?.id ?? "");
  const selectedFarm = data.farms.find((farm) => farm.id === farmId);
  const weatherFarm = selectedFarm || data.farms[0];
  const tasks = agendaTasks(data.tasks, filter, day, farmId);
  const farms = selectedFarm ? [selectedFarm] : data.farms;
  const collections = data.collections
    .filter((collection) =>
      ["planning", "confirmed"].includes(collection.status),
    )
    .sort((a, b) => a.collectionDate.localeCompare(b.collectionDate));
  const followUps = data.contacts.filter(
    (contact) => contact.stage === "follow_up",
  );
  const reports = data.reports.filter((report) => report.status !== "resolved");
  async function toggleTask(task: Task) {
    setBusy(task.id);
    setError("");
    try {
      await mutate(
        `/api/tasks/${task.id}`,
        "PATCH",
        {
          version: task.version,
          status: task.status === "completed" ? "pending" : "completed",
        },
        true,
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (loading || (!lastSync && !workspaceError)) return <Skeleton />;
  if (!lastSync || (staff && !online))
    return (
      <div className="workspace-panel agenda-empty">
        <IconSeedling size={30} />
        <h1>Let’s reconnect to your workspace.</h1>
        <p>
          {staff
            ? "Cooperative records need a connection. Reconnect to see your team's current workload."
            : "Your records could not be loaded. Reconnect and try again."}
        </p>
        <Button
          busy={refreshing}
          onClick={() => {
            setRefreshing(true);
            void refresh()
              .catch(() => {})
              .finally(() => setRefreshing(false));
          }}
        >
          Try again
        </Button>
        <Link className="text-link" to="/settings">
          Connection settings <IconArrowRight size={16} />
        </Link>
      </div>
    );
  return (
    <div className="workspace-home">
      <header className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">
            {staff ? "COOPERATIVE OVERVIEW" : "YOUR FARM WORKSPACE"}{" "}
            <span>· {date(day)}</span>
          </span>
          <h1>Hello, {user?.name.split(" ")[0]}.</h1>
          <p>
            A good day to move forward.{" "}
            {staff
              ? "Your farms, your team, your next step."
              : "A little planning. A better growing season."}
          </p>
        </div>
        <div className="page-heading-actions">
          <Link className="button button-primary" to="/marketplace">
            Find buyers <IconArrowUpRight size={18} />
          </Link>
          <Button
            variant="secondary"
            onClick={() => setEditor(data.farms.length ? "task" : "farm")}
          >
            <IconPlus size={18} />{" "}
            {data.farms.length ? "Add task" : "Add your first farm"}
          </Button>
        </div>
      </header>
      {queue.length > 0 && (
        <Notice tone="warning">
          {queue.length} change{queue.length === 1 ? "" : "s"} saved on this
          device, awaiting server confirmation. New records appear after sync.{" "}
          <Link to="/settings">Review saved changes</Link>
        </Notice>
      )}
      {staff && (
        <div className="workspace-scope">
          <span>
            <span className="live-dot" />
            Your cooperative at a glance
          </span>
          <label>
            <span>Farm</span>
            <select
              aria-label="Filter workspace by farm"
              value={farmId}
              onChange={(event) => setFarmId(event.target.value)}
            >
              <option value="">All farms</option>
              {data.farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="home-dash-top">
        <HomeWeather district={weatherFarm?.district} />
        <SeasonOverview seasons={data.seasons} farmId={farmId} today={day} />
        <div className="home-dash-stats">
          <LandStat farms={farms} />
          <SalesStat transactions={data.transactions} today={day} />
        </div>
      </div>
      {staff && (
        <section
          className="workspace-panel cooperative-priorities"
          aria-labelledby="team-title"
        >
          <div className="panel-heading">
            <div>
              <span className="workspace-eyebrow">
                ACROSS THE COOPERATIVE · ALL FARMS
              </span>
              <h2 id="team-title">
                <IconUsers size={22} /> Team priorities
              </h2>
            </div>
            <Link className="text-link" to="/crm">
              Farmer relationships <IconArrowUpRight size={16} />
            </Link>
          </div>
          <div className="priority-grid">
            <Link to="/harvest">
              <span className="priority-number">{collections.length}</span>
              <strong>Active collections</strong>
              <p>
                {collections[0]
                  ? `Next: ${collections[0].name} · ${date(collections[0].collectionDate)}`
                  : "Plan a collection and bring harvests together."}
              </p>
              <span className="text-link">
                Open harvest & collection <IconArrowRight size={16} />
              </span>
            </Link>
            <Link to="/crm">
              <span className="priority-number">{followUps.length}</span>
              <strong>Farmer & contact follow-ups</strong>
              <p>
                Keep relationships moving with the people who need your
                attention.
              </p>
              <span className="text-link">
                Review contacts <IconArrowRight size={16} />
              </span>
            </Link>
            <Link to="/community">
              <span className="priority-number">{reports.length}</span>
              <strong>Open community reports</strong>
              <p>Review crop concerns and help coordinate the next response.</p>
              <span className="text-link">
                Review reports <IconArrowRight size={16} />
              </span>
            </Link>
          </div>
        </section>
      )}
      <div className="home-dash-row">
        <SalesChart transactions={data.transactions} today={day} />
        <FarmSpotlight
          farm={selectedFarm ?? farms[0]}
          onAddFarm={() => setEditor("farm")}
        />
      </div>
      <div className="home-dash-row">
        <section
          className="workspace-panel agenda-panel"
          aria-labelledby="agenda-title"
        >
          <div className="panel-heading">
            <div>
              <span className="workspace-eyebrow">ONE STEP AT A TIME</span>
              <h2 id="agenda-title">Today & upcoming</h2>
            </div>
            <Link className="text-link" to="/farms?tasks=1">
              All tasks <IconArrowUpRight size={16} />
            </Link>
          </div>
          <div className="agenda-filters" aria-label="Filter tasks">
            {filters.map((item) => (
              <button
                key={item.id}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span>
                  {agendaTasks(data.tasks, item.id, day, farmId).length}
                </span>
              </button>
            ))}
          </div>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <div className="agenda-list">
            {tasks.slice(0, 6).map((task) => {
              const waiting = queue.some(
                (change) => change.path === `/api/tasks/${task.id}`,
              );
              const overdue =
                task.status === "pending" && task.dueDate.slice(0, 10) < day;
              return (
                <div className="agenda-row" key={task.id}>
                  <button
                    className={`task-check ${task.status === "completed" ? "is-complete" : ""}`}
                    aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}
                    disabled={!!busy || waiting}
                    onClick={() => void toggleTask(task)}
                  >
                    {task.status === "completed" ? (
                      <IconCheck size={16} />
                    ) : busy === task.id ? (
                      <span className="task-pulse" />
                    ) : null}
                  </button>
                  <Link
                    className="agenda-task"
                    to={`/farms?tasks=1&task=${encodeURIComponent(task.id)}`}
                  >
                    <strong>{task.title}</strong>
                    <small>
                      {data.farms.find((farm) => farm.id === task.farmId)
                        ?.name || "General task"}{" "}
                      <span>· {label(task.category)}</span>
                    </small>
                  </Link>
                  <span className={`agenda-due ${overdue ? "is-overdue" : ""}`}>
                    {waiting
                      ? "Awaiting sync"
                      : task.status === "completed"
                        ? "Completed"
                        : `${overdue ? "Overdue · " : ""}${dueLabel(task.dueDate)}`}
                  </span>
                </div>
              );
            })}
            {!tasks.length && (
              <div className="agenda-empty">
                <IconChecks size={28} />
                <h3>
                  {filter === "today"
                    ? "A clear day ahead."
                    : filter === "overdue"
                      ? "Nothing overdue."
                      : filter === "completed"
                        ? "Your progress starts here."
                        : "Ready for your next step."}
                </h3>
                <p>
                  {filter === "completed"
                    ? "Completed tasks will appear here."
                    : "Add a task to plan ahead, or check another view."}
                </p>
                <button className="text-link" onClick={() => setEditor("task")}>
                  <IconPlus size={16} /> Plan a task
                </button>
              </div>
            )}
          </div>
          {tasks.length > 6 && (
            <Link className="agenda-more" to="/farms?tasks=1">
              {tasks.length} tasks in this view · Open all tasks{" "}
              <IconArrowRight size={16} />
            </Link>
          )}
        </section>
        <RecentTransactions transactions={data.transactions} />
      </div>
      {staff && (
        <section className="workspace-panel" aria-labelledby="farms-title">
          <div className="panel-heading">
            <div>
              <span className="workspace-eyebrow">ROOTED IN YOUR RECORDS</span>
              <h2 id="farms-title">{staff ? "Farms in focus" : "Your farm"}</h2>
            </div>
            <button className="text-link" onClick={() => setEditor("farm")}>
              <IconPlus size={16} /> Add farm
            </button>
          </div>
          <div className="workspace-farms">
            {farms.slice(0, 4).map((farm) => (
              <Link
                className="workspace-farm-row"
                to={`/farms?farm=${encodeURIComponent(farm.id)}`}
                key={farm.id}
              >
                <span className="farm-symbol">
                  <IconSeedling size={24} />
                </span>
                <span>
                  <strong>{farm.name}</strong>
                  <small>
                    {farm.district} · {number(farm.areaAcres)} acres
                  </small>
                </span>
                <span className="farm-crop">
                  <strong>{farm.crop}</strong>
                  <small>{label(farm.stage)}</small>
                </span>
                <IconArrowUpRight size={17} />
              </Link>
            ))}
          </div>
          {!farms.length && (
            <div className="agenda-empty">
              <IconSeedling size={28} />
              <h3>Start with your first farm.</h3>
              <p>
                Keep crop records, plan field work and track each season in one
                place.
              </p>
              <Button onClick={() => setEditor("farm")}>
                <IconPlus size={16} /> Add a farm
              </Button>
            </div>
          )}
          {farms.length > 4 && (
            <Link className="agenda-more" to="/farms">
              Explore all {farms.length} farms <IconArrowRight size={16} />
            </Link>
          )}
        </section>
      )}
      <WorkspaceJourney />
      {editor === "farm" && <FarmEditor onClose={() => setEditor(null)} />}
      {editor === "task" && (
        <TaskEditor farmId={farmId} onClose={() => setEditor(null)} />
      )}
    </div>
  );
}
