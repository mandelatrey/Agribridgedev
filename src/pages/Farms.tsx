import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  Sprout,
  MapPin,
  ArrowUpRight,
  Check,
  CalendarDays,
  Pencil,
  ClipboardList,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Badge,
  Button,
  Empty,
  Field,
  Form,
  Modal,
  Notice,
  PageHeader,
  SearchInput,
  fieldNumber,
  fieldText,
} from "../components/ui";
import {
  crops,
  date,
  districts,
  dueLabel,
  label,
  number,
  today,
} from "../lib/format";
import type { Farm, Task } from "../types";
import { revealRecordTarget } from "../lib/useRecordDetails";
import { setActiveFarmId, useActiveFarm } from "../lib/active-farm";
import "../styles/farm-detail.css";

/** Cached notes are intentionally absent; an offline edit must never erase them. */
export function onlineNotes(
  value: string,
  previous: string | undefined,
  online: boolean,
): { notes?: string } {
  return online && value !== (previous ?? "") ? { notes: value } : {};
}

export function compareTasks(a: Task, b: Task): number {
  return (
    Number(a.status === "completed") - Number(b.status === "completed") ||
    a.dueDate.localeCompare(b.dueDate) ||
    a.title.localeCompare(b.title)
  );
}

/** A task link selects only an exact record from this user's loaded workspace. */
export function findLinkedTask(
  tasks: readonly Task[],
  requestedId: string | null,
): Task | undefined {
  return requestedId
    ? tasks.find((task) => task.id === requestedId)
    : undefined;
}

export function FarmEditor({
  farm,
  onClose,
}: {
  farm?: Farm;
  onClose: () => void;
}) {
  const { mutate, user, online } = useApp();
  const close = useCallback(onClose, [onClose]);
  const [district, setDistrict] = useState(farm?.district ?? "Nakaseke");
  const [initialNotes] = useState(online ? (farm?.notes ?? "") : "");
  const [notes, setNotes] = useState(initialNotes);
  return (
    <Modal
      title={farm ? "Edit farm" : "A place to start growing."}
      description="Keep your crop, location, and season in one place."
      onClose={close}
    >
      <Form
        onCancel={close}
        submitLabel={farm ? "Save farm" : "Create farm"}
        onSubmit={async (fd) => {
          if (!online && notes.trim() !== initialNotes)
            throw new Error(
              "Your note change is still in this open form. Reconnect before saving; private notes cannot enter the offline queue.",
            );
          const loc =
            districts.find((d) => d.name === district) ?? districts[0];
          await mutate(
            farm ? `/api/farms/${farm.id}` : "/api/farms",
            farm ? "PATCH" : "POST",
            {
              name: fieldText(fd, "name"),
              district,
              latitude: loc.latitude,
              longitude: loc.longitude,
              areaAcres: fieldNumber(fd, "areaAcres"),
              crop: fieldText(fd, "crop"),
              plantedAt: fieldText(fd, "plantedAt"),
              ownerName: fieldText(fd, "ownerName"),
              stage: fieldText(fd, "stage"),
              ...onlineNotes(notes.trim(), initialNotes, online),
              ...(farm ? { version: farm.version } : {}),
            },
            true,
          );
          close();
        }}
      >
        <Field label="Farm / plot name">
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={farm?.name}
            placeholder="e.g. Home maize field"
          />
        </Field>
        <Field label="Farmer’s name">
          <input
            name="ownerName"
            required
            maxLength={120}
            defaultValue={farm?.ownerName ?? user?.name}
          />
        </Field>
        <Field
          label="District"
          hint="Uses the district centre. Exact home coordinates are not required."
        >
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            {districts.map((d) => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Main crop">
          <select name="crop" defaultValue={farm?.crop ?? "Maize"}>
            {crops.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Area (acres)">
          <input
            type="number"
            name="areaAcres"
            min="0.01"
            max="100000"
            step="0.01"
            required
            defaultValue={farm?.areaAcres ?? 1}
          />
        </Field>
        <Field label="Planting date">
          <input
            type="date"
            name="plantedAt"
            required
            defaultValue={farm?.plantedAt?.slice(0, 10) ?? today()}
          />
        </Field>
        <Field label="Crop stage">
          <select name="stage" defaultValue={farm?.stage ?? "planning"}>
            {["planning", "planted", "growing", "harvesting", "fallow"].map(
              (s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label="Notes">
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            disabled={!online}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Seed variety, soil observations, or plans"
          />
          {!online && (
            <small>
              Private notes stay online. Existing notes will not change when
              this farm syncs.
            </small>
          )}
        </Field>
      </Form>
    </Modal>
  );
}
export function TaskEditor({
  onClose,
  farmId = "",
}: {
  onClose: () => void;
  farmId?: string;
}) {
  const { data, mutate, online } = useApp();
  const [notes, setNotes] = useState("");
  return (
    <Modal
      title="Plan your next step"
      description="One clear task. A date to get it done."
      onClose={onClose}
    >
      <Form
        onCancel={onClose}
        submitLabel="Add task"
        onSubmit={async (fd) => {
          if (!online && notes.trim())
            throw new Error(
              "Your private details remain in this open form. Reconnect before saving them.",
            );
          await mutate(
            "/api/tasks",
            "POST",
            {
              title: fieldText(fd, "title"),
              farmId: fieldText(fd, "farmId"),
              dueDate: fieldText(fd, "dueDate"),
              category: fieldText(fd, "category"),
              status: "pending",
              ...onlineNotes(notes.trim(), "", online),
            },
            true,
          );
          onClose();
        }}
      >
        <Field label="What needs doing?">
          <input
            name="title"
            required
            maxLength={200}
            placeholder="e.g. Check the bean plot"
          />
        </Field>
        <Field label="Farm">
          <select name="farmId" defaultValue={farmId}>
            <option value="">General task</option>
            {data.farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date">
          <input type="date" name="dueDate" required defaultValue={today()} />
        </Field>
        <Field label="Category">
          <select name="category">
            {[
              "general",
              "scouting",
              "planting",
              "harvest",
              "learning",
              "follow_up",
            ].map((s) => (
              <option key={s} value={s} disabled={!online && s === "follow_up"}>
                {label(s)}
              </option>
            ))}
          </select>
        </Field>
        <div className="full-width">
          <Field label="Helpful details">
            <textarea
              name="notes"
              maxLength={2000}
              disabled={!online}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            {!online && (
              <small>
                Private details can be added when connected. They are not saved
                on this device.
              </small>
            )}
          </Field>
        </div>
      </Form>
    </Modal>
  );
}
export default function Farms() {
  const { data, mutate, notify, queue, user, loading } = useApp();
  const waiting = (path: string) =>
    queue.some((change) => change.path === path);
  const [params, setParams] = useSearchParams();
  const tab = params.has("tasks") ? "tasks" : "farms";
  const farmer = user?.role === "farmer";
  const activeFarm = useActiveFarm(user?.id, data.farms);
  // Farmers see one farm at a time: the one chosen in the sidebar.
  const focusFarm = farmer ? activeFarm : undefined;
  const farmTitle = focusFarm ? focusFarm.name : farmer ? "My farms" : "Farms";
  const requestedTaskId = tab === "tasks" ? params.get("task") : null;
  const linkedTask = findLinkedTask(data.tasks, requestedTaskId);
  const selectedTaskId = linkedTask?.id;
  // A link to another farm's record switches the farmer to that farm.
  const linkedFarmId = params.get("farm") || linkedTask?.farmId;
  useEffect(() => {
    if (
      farmer &&
      linkedFarmId &&
      linkedFarmId !== activeFarm?.id &&
      data.farms.some((farm) => farm.id === linkedFarmId)
    )
      setActiveFarmId(user?.id, linkedFarmId);
  }, [farmer, linkedFarmId, activeFarm?.id, data.farms, user?.id]);
  const farmIds = new Set(data.farms.map((farm) => farm.id));
  const visibleTasks = focusFarm
    ? data.tasks.filter(
        (task) => task.farmId === focusFarm.id || !farmIds.has(task.farmId),
      )
    : data.tasks;
  const selectedTaskRef = useRef<HTMLDivElement>(null);
  const selectedFarmRef = useRef<HTMLElement>(null);
  const selectedFarmId = tab === "farms" ? params.get("farm") : null;
  const tasksHeadingRef = useRef<HTMLHeadingElement>(null);
  const allTaskParams = new URLSearchParams(params);
  allTaskParams.delete("task");
  allTaskParams.set("tasks", "1");
  useEffect(() => {
    if (loading || !selectedTaskId) return;
    const frame = requestAnimationFrame(() => {
      revealRecordTarget(selectedTaskRef.current, "center");
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, selectedTaskId]);
  useEffect(() => {
    if (loading || !selectedFarmId) return;
    setQuery("");
    const frame = requestAnimationFrame(() =>
      revealRecordTarget(selectedFarmRef.current, "center"),
    );
    return () => cancelAnimationFrame(frame);
  }, [loading, selectedFarmId]);
  const [query, setQuery] = useState(""),
    [editor, setEditor] = useState<Farm | true | null>(null),
    [addTask, setAddTask] = useState(false),
    [busy, setBusy] = useState("");
  const farms = data.farms.filter((f) =>
    `${f.name} ${f.crop} ${f.district} ${f.ownerName}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const closeFarm = useCallback(() => setEditor(null), []),
    closeTask = useCallback(() => setAddTask(false), []);
  async function toggle(task: Task) {
    setBusy(task.id);
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
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeader
        title={farmTitle}
        description={
          focusFarm
            ? `${focusFarm.district} · ${focusFarm.crop} · ${label(focusFarm.stage)}`
            : "Your land, your crops, and a plan for the season."
        }
        action={
          focusFarm && tab === "farms" ? (
            <>
              <Button variant="secondary" onClick={() => setEditor(true)}>
                <Plus size={18} />
                Add a farm
              </Button>
              <Button
                disabled={waiting(`/api/farms/${focusFarm.id}`)}
                onClick={() => setEditor(focusFarm)}
              >
                <Pencil size={18} />
                Edit farm
              </Button>
            </>
          ) : (
            <Button
              onClick={() =>
                tab === "tasks" ? setAddTask(true) : setEditor(true)
              }
            >
              <Plus size={18} />
              {tab === "tasks" ? "Add a task" : "Add a farm"}
            </Button>
          )
        }
      />
      {queue.length > 0 && (
        <Notice tone="warning">
          {queue.length} change{queue.length === 1 ? "" : "s"} saved on this
          device, not yet confirmed by the server. New records appear after
          sync. <Link to="/settings">Review saved changes</Link>
        </Notice>
      )}
      <div className="tabs">
        <button
          className={tab === "farms" ? "active" : ""}
          onClick={() => setParams({})}
        >
          {focusFarm ? (
            "Farm details"
          ) : (
            <>
              {farmTitle} <span>{data.farms.length}</span>
            </>
          )}
        </button>
        <button
          className={tab === "tasks" ? "active" : ""}
          onClick={() => setParams({ tasks: "1" })}
        >
          Tasks{" "}
          <span>
            {visibleTasks.filter((t) => t.status === "pending").length}
          </span>
        </button>
      </div>
      {tab === "farms" && focusFarm ? (
        <FarmDetails
          farm={focusFarm}
          tasks={visibleTasks}
          pendingSync={waiting(`/api/farms/${focusFarm.id}`)}
        />
      ) : tab === "farms" ? (
        <>
          <div className="toolbar">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search by farm, crop or district"
            />
            <span className="muted">
              {number(data.farms.reduce((n, f) => n + f.areaAcres, 0))} acres
              recorded
            </span>
          </div>
          <div className="farm-grid">
            {farms.map((f) => (
              <article
                className={`farm-card ${selectedFarmId === f.id ? "workspace-record-target" : ""}`}
                key={f.id}
                ref={selectedFarmId === f.id ? selectedFarmRef : undefined}
                tabIndex={selectedFarmId === f.id ? -1 : undefined}
              >
                <div className={`farm-card-top crop-${f.crop.toLowerCase()}`}>
                  <div className="crop-emblem">
                    <Sprout size={42} strokeWidth={1.2} />
                  </div>
                  <Badge tone="green">{label(f.stage)}</Badge>
                  <span>{f.crop}</span>
                </div>
                <div className="farm-card-body">
                  <div className="farm-title">
                    <h2>{f.name}</h2>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${f.name}`}
                      disabled={waiting(`/api/farms/${f.id}`)}
                      onClick={() => setEditor(f)}
                    >
                      <Pencil size={17} />
                    </button>
                  </div>
                  {waiting(`/api/farms/${f.id}`) && (
                    <Badge tone="amber">Saved on device · awaiting sync</Badge>
                  )}
                  <p className="icon-text">
                    <MapPin size={14} />
                    {f.district} · {f.ownerName}
                  </p>
                  <div className="farm-meta">
                    <span>
                      <small>Land area</small>
                      <strong>{number(f.areaAcres)} acres</strong>
                    </span>
                    <span>
                      <small>Planted</small>
                      <strong>{date(f.plantedAt)}</strong>
                    </span>
                  </div>
                  <div className="farm-links">
                    <Link
                      to={`/weather?district=${encodeURIComponent(f.district)}`}
                    >
                      Local forecast
                      <ArrowUpRight size={15} />
                    </Link>
                    <Link to={`/learn?crop=${encodeURIComponent(f.crop)}`}>
                      Crop guide
                      <ArrowUpRight size={15} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!farms.length && (
            <Empty
              icon={Sprout}
              title={
                query
                  ? "No matching farms"
                  : "Your next season starts with a farm."
              }
              body={
                query
                  ? "Try another farm name, crop or district."
                  : "Add your first plot to keep records, tasks, and learning together."
              }
              action={
                query ? (
                  <Button variant="secondary" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                ) : (
                  <Button onClick={() => setEditor(true)}>
                    <Plus size={16} />
                    Add a farm
                  </Button>
                )
              }
            />
          )}
        </>
      ) : (
        <section className="panel">
          <div className="panel-header">
            <h2 ref={tasksHeadingRef} tabIndex={-1} className="op-focus-target">
              Your season, one step at a time
            </h2>
            {requestedTaskId !== null ? (
              <Link
                className="text-link"
                to={`/farms?${allTaskParams.toString()}`}
                onClick={() => revealRecordTarget(tasksHeadingRef.current)}
              >
                Show all tasks
              </Link>
            ) : (
              <CalendarDays size={20} />
            )}
          </div>
          {!loading && requestedTaskId !== null && !selectedTaskId && (
            <Notice>
              That task isn’t in your current task list. All available tasks are
              shown below.
            </Notice>
          )}
          {[...visibleTasks].sort(compareTasks).map((task) => (
            <div
              key={task.id}
              ref={task.id === selectedTaskId ? selectedTaskRef : undefined}
              tabIndex={task.id === selectedTaskId ? -1 : undefined}
              role={task.id === selectedTaskId ? "group" : undefined}
              aria-label={
                task.id === selectedTaskId
                  ? `Selected task: ${task.title}`
                  : undefined
              }
              className={`task-row full-task ${task.status === "completed" ? "task-complete" : ""} ${task.id === selectedTaskId ? "op-selected-row op-focus-target" : ""}`}
              style={
                task.id === selectedTaskId
                  ? {
                      outline: "2px solid var(--green)",
                      outlineOffset: "4px",
                      borderRadius: "4px",
                    }
                  : undefined
              }
            >
              <button
                className="task-check"
                aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}
                disabled={busy === task.id || waiting(`/api/tasks/${task.id}`)}
                onClick={() => void toggle(task)}
              >
                {task.status === "completed" && <Check size={16} />}
              </button>
              <div className="task-copy">
                <strong>{task.title}</strong>
                <span>
                  {data.farms.find((f) => f.id === task.farmId)?.name ??
                    "General"}{" "}
                  · {task.notes}
                </span>
              </div>
              <Badge tone={task.status === "completed" ? "green" : "neutral"}>
                {waiting(`/api/tasks/${task.id}`)
                  ? "Awaiting sync"
                  : task.status === "completed"
                    ? "Done"
                    : dueLabel(task.dueDate)}
              </Badge>
            </div>
          ))}
          {!visibleTasks.length && (
            <Empty
              icon={ClipboardList}
              title="A clear plan for the days ahead."
              body="Add a task to start your season’s checklist."
            />
          )}
        </section>
      )}
      {editor && (
        <FarmEditor
          farm={editor === true ? undefined : editor}
          onClose={closeFarm}
        />
      )}{" "}
      {addTask && <TaskEditor farmId={focusFarm?.id} onClose={closeTask} />}
    </>
  );
}

function FarmDetails({
  farm,
  tasks,
  pendingSync,
}: {
  farm: Farm;
  tasks: Task[];
  pendingSync: boolean;
}) {
  const { data } = useApp();
  const upcoming = tasks
    .filter((task) => task.status === "pending")
    .sort(compareTasks)
    .slice(0, 4);
  const seasons = data.seasons.filter(
    (season) => season.farmId === farm.id && season.status === "active",
  );
  return (
    <div className="farm-detail">
      <article className="farm-card farm-detail-card">
        <div className={`farm-card-top crop-${farm.crop.toLowerCase()}`}>
          <div className="crop-emblem">
            <Sprout size={42} strokeWidth={1.2} />
          </div>
          <Badge tone="green">{label(farm.stage)}</Badge>
          <span>{farm.crop}</span>
        </div>
        <div className="farm-card-body">
          {pendingSync && (
            <Badge tone="amber">Saved on device · awaiting sync</Badge>
          )}
          <dl className="farm-detail-facts">
            <div>
              <dt>Crop</dt>
              <dd>{farm.crop}</dd>
            </div>
            <div>
              <dt>Growth stage</dt>
              <dd>{label(farm.stage)}</dd>
            </div>
            <div>
              <dt>Land area</dt>
              <dd>{number(farm.areaAcres)} acres</dd>
            </div>
            <div>
              <dt>Planted</dt>
              <dd>{date(farm.plantedAt)}</dd>
            </div>
            <div>
              <dt>District</dt>
              <dd className="icon-text">
                <MapPin size={14} />
                {farm.district}
              </dd>
            </div>
            <div>
              <dt>Farmer</dt>
              <dd>{farm.ownerName}</dd>
            </div>
          </dl>
          {farm.notes && (
            <div className="farm-detail-notes">
              <h3>Notes</h3>
              <p>{farm.notes}</p>
            </div>
          )}
          <div className="farm-links">
            <Link to={`/weather?district=${encodeURIComponent(farm.district)}`}>
              Local forecast
              <ArrowUpRight size={15} />
            </Link>
            <Link to={`/learn?crop=${encodeURIComponent(farm.crop)}`}>
              Crop guide
              <ArrowUpRight size={15} />
            </Link>
            <Link to={`/seasons?farm=${encodeURIComponent(farm.id)}`}>
              {seasons.length
                ? `Season plan (${seasons.length} active)`
                : "Plan a season"}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </article>
      <section className="panel farm-detail-next">
        <div className="panel-header">
          <h2>Next on this farm</h2>
          <Link className="text-link" to="/farms?tasks=1">
            All tasks
          </Link>
        </div>
        {upcoming.map((task) => (
          <Link
            key={task.id}
            className="farm-detail-task"
            to={`/farms?tasks=1&task=${encodeURIComponent(task.id)}`}
          >
            <span>
              <strong>{task.title}</strong>
              <small>{label(task.category)}</small>
            </span>
            <Badge>{dueLabel(task.dueDate)}</Badge>
          </Link>
        ))}
        {!upcoming.length && (
          <p className="muted">
            No open tasks on this farm. Add one from Tasks.
          </p>
        )}
      </section>
    </div>
  );
}
