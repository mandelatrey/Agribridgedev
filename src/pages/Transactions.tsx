import { useCallback, useMemo, useState } from "react";
import {
  IconArrowRight,
  IconArrowsLeftRight,
  IconPencil,
  IconPlus,
} from "@tabler/icons-react";
import { useApp } from "../context/AppContext";
import {
  Badge,
  Button,
  Empty,
  ErrorMessage,
  Field,
  Form,
  Modal,
  Notice,
  PageHeader,
  SearchInput,
  Skeleton,
  fieldNumber,
  fieldText,
} from "../components/ui";
import { crops, date, label, number, today, ugx } from "../lib/format";
import { useActiveFarm } from "../lib/active-farm";
import type { PaymentMethod, Transaction, TransactionStatus } from "../types";
import "../styles/transactions.css";

export const TRANSACTION_STATUSES: TransactionStatus[] = [
  "pending",
  "confirmed",
  "in_transit",
  "delivered",
  "cancelled",
];
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "not_recorded", label: "Not recorded yet" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
];
const PAYMENT_PROVIDERS: Record<PaymentMethod, string[]> = {
  not_recorded: [],
  mobile_money: ["MTN MoMo", "Airtel Money"],
  bank_transfer: [
    "Stanbic Bank",
    "DFCU Bank",
    "Centenary Bank",
    "Equity Bank",
    "Absa Uganda",
  ],
  cash: [],
  cheque: ["Stanbic Bank", "DFCU Bank", "Centenary Bank"],
};
const statusTone = (status: TransactionStatus) =>
  status === "delivered"
    ? "green"
    : status === "in_transit"
      ? "blue"
      : status === "cancelled"
        ? "red"
        : status === "pending"
          ? "amber"
          : "neutral";
const paymentLabel = (method: PaymentMethod) =>
  PAYMENT_METHODS.find((item) => item.value === method)?.label ?? method;

/** Value of trades that still count: cancelled transactions are excluded. */
export function transactionTotals(transactions: Transaction[]) {
  const live = transactions.filter((item) => item.status !== "cancelled");
  const sum = (kind: Transaction["kind"]) =>
    live
      .filter((item) => item.kind === kind)
      .reduce((total, item) => total + item.totalUgx, 0);
  return {
    count: transactions.length,
    sales: sum("sell"),
    purchases: sum("buy"),
    pending: transactions.filter((item) => item.status === "pending").length,
  };
}

/** The counterparty is whoever is not you on this transaction. */
export function counterparty(transaction: Transaction) {
  return transaction.kind === "sell" ? transaction.buyer : transaction.seller;
}

function TransactionEditor({
  transaction,
  onClose,
}: {
  transaction?: Transaction;
  onClose: () => void;
}) {
  const { data, user, mutate } = useApp();
  const activeFarm = useActiveFarm(user?.id, data.farms);
  const farmer = user?.role === "farmer";
  const ourName = farmer
    ? (user?.name ?? "")
    : (user?.organizationName.replace(" · Sample cooperative", "") ?? "");
  const canEditDate = !transaction || user?.role === "admin";
  const [kind, setKind] = useState<Transaction["kind"]>(
    transaction?.kind ?? "sell",
  );
  const [buyer, setBuyer] = useState(transaction?.buyer ?? "");
  const [seller, setSeller] = useState(transaction?.seller ?? ourName);
  const [quantity, setQuantity] = useState(
    transaction ? String(transaction.quantityKg) : "",
  );
  const [price, setPrice] = useState(
    transaction ? String(transaction.unitPriceUgx) : "",
  );
  const [method, setMethod] = useState<PaymentMethod>(
    transaction?.paymentMethod ?? "not_recorded",
  );
  const total = Math.round(Number(quantity) * Number(price));
  const providers = PAYMENT_PROVIDERS[method];

  // Keep your own name on your side when switching between buying and selling.
  function changeKind(next: Transaction["kind"]) {
    if (next === kind) return;
    setKind(next);
    setBuyer(seller);
    setSeller(buyer);
  }

  async function save(form: FormData) {
    const body = {
      kind,
      crop: fieldText(form, "crop"),
      quantityKg: fieldNumber(form, "quantityKg"),
      unitPriceUgx: fieldNumber(form, "unitPriceUgx"),
      ...(canEditDate
        ? { transactionDate: fieldText(form, "transactionDate") }
        : {}),
      buyer: buyer.trim(),
      seller: seller.trim(),
      farmId: fieldText(form, "farmId"),
      status: fieldText(form, "status"),
      paymentMethod: method,
      paymentProvider:
        method === "cash" ? "Cash" : fieldText(form, "paymentProvider"),
      notes: fieldText(form, "notes"),
      ...(transaction ? { version: transaction.version } : {}),
    };
    await mutate(
      transaction ? `/api/transactions/${transaction.id}` : "/api/transactions",
      transaction ? "PATCH" : "POST",
      body,
      false,
    );
    onClose();
  }

  return (
    <Modal
      title={transaction ? "Edit transaction" : "Record a transaction"}
      description={
        transaction
          ? `Update ${transaction.reference}.`
          : "A sale or purchase, with who it was with and where it stands."
      }
      onClose={onClose}
      wide
    >
      <Form
        onSubmit={save}
        onCancel={onClose}
        submitLabel={transaction ? "Save changes" : "Record transaction"}
      >
        <div className="op-full">
          <fieldset className="txn-kind">
            <legend>What happened?</legend>
            {(["sell", "buy"] as const).map((value) => (
              <label key={value} className={kind === value ? "active" : ""}>
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => changeKind(value)}
                />
                <span>
                  <strong>{value === "sell" ? "I sold" : "I bought"}</strong>
                  <small>
                    {value === "sell"
                      ? "Produce leaving the farm"
                      : "Produce, seed or inputs coming in"}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
        <Field label="Crop or product">
          <input
            name="crop"
            list="transaction-crops"
            defaultValue={transaction?.crop ?? activeFarm?.crop}
            required
            maxLength={160}
          />
          <datalist id="transaction-crops">
            {crops.map((crop) => (
              <option key={crop} value={crop} />
            ))}
          </datalist>
        </Field>
        {canEditDate ? (
          <Field label="Date">
            <input
              name="transactionDate"
              type="date"
              max={today()}
              defaultValue={transaction?.transactionDate ?? today()}
              required
            />
          </Field>
        ) : (
          <Field
            label="Date"
            hint="Only an administrator can change a recorded date."
          >
            <input value={date(transaction?.transactionDate)} readOnly />
          </Field>
        )}
        <Field label="Quantity (kg)">
          <input
            name="quantityKg"
            type="number"
            min="0.1"
            max="10000000"
            step="0.1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </Field>
        <Field label="Price (UGX per kg)">
          <input
            name="unitPriceUgx"
            type="number"
            min="1"
            max="10000000"
            step="1"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
          />
        </Field>
        <div className="op-full txn-total" aria-live="polite">
          <span>Total</span>
          <strong>{total > 0 ? ugx(total) : "Enter quantity and price"}</strong>
        </div>
        <Field label={kind === "sell" ? "Buyer" : "Buyer (you)"}>
          <input
            value={buyer}
            onChange={(event) => setBuyer(event.target.value)}
            placeholder={kind === "sell" ? "Person or business" : ""}
            required
            maxLength={160}
          />
        </Field>
        <Field label={kind === "buy" ? "Seller" : "Seller (you)"}>
          <input
            value={seller}
            onChange={(event) => setSeller(event.target.value)}
            placeholder={kind === "buy" ? "Person, shop or business" : ""}
            required
            maxLength={160}
          />
        </Field>
        <Field
          label="Farm"
          hint={
            farmer
              ? undefined
              : "Linking a farmer's farm shows this transaction to that farmer."
          }
        >
          <select
            name="farmId"
            defaultValue={
              transaction ? (transaction.farmId ?? "") : (activeFarm?.id ?? "")
            }
          >
            <option value="">Not linked to a farm</option>
            {data.farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={transaction?.status ?? "pending"}>
            {TRANSACTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment method">
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          >
            {PAYMENT_METHODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        {providers.length > 0 && (
          <Field label="Provider">
            <select
              key={method}
              name="paymentProvider"
              defaultValue={
                transaction?.paymentMethod === method
                  ? transaction.paymentProvider
                  : ""
              }
            >
              <option value="">Not specified</option>
              {providers.map((provider) => (
                <option key={provider}>{provider}</option>
              ))}
            </select>
          </Field>
        )}
        <div className="op-full">
          <Notice>
            Payment details are for your records. Agribridge does not send,
            receive or verify money.
          </Notice>
        </div>
        <div className="op-full">
          <Field label="Notes (optional)">
            <textarea
              name="notes"
              defaultValue={transaction?.notes}
              rows={3}
              maxLength={3000}
              placeholder="Delivery place, quality agreed, or who handles the next step."
            />
          </Field>
        </div>
      </Form>
    </Modal>
  );
}

function TransactionDetails({
  transaction,
  onEdit,
  onClose,
}: {
  transaction: Transaction;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { data, mutate, online } = useApp();
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const farm = data.farms.find((item) => item.id === transaction.farmId);
  const index = TRANSACTION_STATUSES.indexOf(transaction.status);
  const next =
    transaction.status === "cancelled" || transaction.status === "delivered"
      ? undefined
      : TRANSACTION_STATUSES[index + 1];
  async function setStatus(status: TransactionStatus) {
    setBusy(status);
    setError("");
    try {
      await mutate(
        `/api/transactions/${transaction.id}`,
        "PATCH",
        { status, version: transaction.version },
        false,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update status.",
      );
    } finally {
      setBusy("");
    }
  }
  const rows: [string, string][] = [
    ["Reference", transaction.reference],
    ["Date", date(transaction.transactionDate)],
    ["Type", transaction.kind === "sell" ? "Sale" : "Purchase"],
    ["Crop or product", transaction.crop],
    ["Quantity", `${number(transaction.quantityKg)} kg`],
    ["Price", `${ugx(transaction.unitPriceUgx)} per kg`],
    ["Total", ugx(transaction.totalUgx)],
    ["Buyer", transaction.buyer],
    ["Seller", transaction.seller],
    ["Farm", farm?.name ?? "Not linked"],
    [
      "Payment",
      [paymentLabel(transaction.paymentMethod), transaction.paymentProvider]
        .filter((part) => part && part !== "Cash")
        .join(" · ") || paymentLabel(transaction.paymentMethod),
    ],
    ["Recorded by", transaction.recordedBy],
  ];
  return (
    <Modal
      title={`${transaction.kind === "sell" ? "Sale" : "Purchase"} · ${transaction.crop}`}
      description={`${transaction.reference} · ${label(transaction.status)}`}
      onClose={onClose}
    >
      <div className="txn-details">
        <dl>
          {rows.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          {transaction.notes && (
            <div>
              <dt>Notes</dt>
              <dd>{transaction.notes}</dd>
            </div>
          )}
        </dl>
        {error && <ErrorMessage message={error} />}
        <footer className="txn-details-actions">
          {transaction.status !== "cancelled" &&
            transaction.status !== "delivered" && (
              <Button
                variant="ghost"
                busy={busy === "cancelled"}
                disabled={!online || Boolean(busy)}
                onClick={() => void setStatus("cancelled")}
              >
                Mark cancelled
              </Button>
            )}
          <Button variant="secondary" disabled={!online} onClick={onEdit}>
            <IconPencil size={16} /> Edit
          </Button>
          {next && (
            <Button
              busy={busy === next}
              disabled={!online || Boolean(busy)}
              onClick={() => void setStatus(next)}
            >
              Mark {label(next).toLowerCase()} <IconArrowRight size={16} />
            </Button>
          )}
        </footer>
      </div>
    </Modal>
  );
}

export default function Transactions() {
  const { data, loading, online, error, refresh } = useApp();
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<Transaction | "new" | null>(null),
    [detailsId, setDetailsId] = useState("");
  const closeEditor = useCallback(() => setEditor(null), []);
  const totals = transactionTotals(data.transactions);
  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return data.transactions
      .filter(
        (item) =>
          (kind === "all" || item.kind === kind) &&
          (status === "all" || item.status === status) &&
          (!search ||
            `${item.reference} ${item.crop} ${item.buyer} ${item.seller}`
              .toLowerCase()
              .includes(search)),
      )
      .sort(
        (a, b) =>
          b.transactionDate.localeCompare(a.transactionDate) ||
          b.createdAt.localeCompare(a.createdAt),
      );
  }, [data.transactions, kind, status, query]);
  const details = data.transactions.find((item) => item.id === detailsId);
  const filtered = Boolean(query) || kind !== "all" || status !== "all";
  if (loading) return <Skeleton />;
  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every sale and purchase, in one place."
        action={
          <Button onClick={() => setEditor("new")} disabled={!online}>
            <IconPlus size={17} />
            Record transaction
          </Button>
        }
      />
      {!online && (
        <Notice>
          Transactions need a connection and are not stored on this device.
        </Notice>
      )}
      {error && (
        <div className="op-error">
          <ErrorMessage message={error} />
          <Button
            variant="secondary"
            onClick={() => void refresh().catch(() => {})}
          >
            Try again
          </Button>
        </div>
      )}
      <div className="stat-strip txn-stats">
        <div className="stat">
          <span>Recorded</span>
          <strong>{number(totals.count)}</strong>
        </div>
        <div className="stat">
          <span>Sales value</span>
          <strong className="op-stat-value">{ugx(totals.sales)}</strong>
        </div>
        <div className="stat">
          <span>Purchases value</span>
          <strong className="op-stat-value">{ugx(totals.purchases)}</strong>
        </div>
        <div className="stat">
          <span>Pending</span>
          <strong>{number(totals.pending)}</strong>
        </div>
      </div>
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search reference, crop, buyer or seller"
        />
        <select
          aria-label="Filter by type"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="all">Sales and purchases</option>
          <option value="sell">Sales</option>
          <option value="buy">Purchases</option>
        </select>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          {TRANSACTION_STATUSES.map((item) => (
            <option key={item} value={item}>
              {label(item)}
            </option>
          ))}
        </select>
      </div>
      <section className="panel">
        <div className="panel-header">
          <h2>Records</h2>
          <span className="muted">
            Showing {rows.length} of {data.transactions.length}
          </span>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table
              className="data-table op-record-table txn-table"
              aria-label="Transactions"
            >
              <thead>
                <tr>
                  <th scope="col">Transaction</th>
                  <th scope="col">Crop</th>
                  <th scope="col">With</th>
                  <th scope="col" className="txn-number">
                    Total
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        className="op-record-link"
                        onClick={() => setDetailsId(item.id)}
                      >
                        <strong>
                          <Badge tone={item.kind === "sell" ? "green" : "blue"}>
                            {item.kind === "sell" ? "Sale" : "Purchase"}
                          </Badge>{" "}
                          {date(item.transactionDate)}
                        </strong>
                        <small>{item.reference}</small>
                      </button>
                    </td>
                    <td data-label="Crop">
                      {item.crop}
                      <small className="op-cell-secondary">
                        {number(item.quantityKg)} kg · {ugx(item.unitPriceUgx)}
                        /kg
                      </small>
                    </td>
                    <td data-label="With">{counterparty(item)}</td>
                    <td data-label="Total" className="txn-number">
                      {ugx(item.totalUgx)}
                    </td>
                    <td data-label="Status">
                      <Badge tone={statusTone(item.status)}>
                        {label(item.status)}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="row-action"
                        onClick={() => setDetailsId(item.id)}
                        aria-label={`View details for ${item.reference}`}
                      >
                        <span className="op-card-action-label">
                          View details
                        </span>
                        <IconArrowRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={IconArrowsLeftRight}
            title={
              filtered ? "No matching transactions" : "No transactions yet"
            }
            body={
              filtered
                ? "Try another search, type or status."
                : "Record a sale or purchase to keep your trading history together."
            }
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setKind("all");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setEditor("new")} disabled={!online}>
                  Record transaction
                </Button>
              )
            }
          />
        )}
      </section>
      {details && !editor && (
        <TransactionDetails
          transaction={details}
          onClose={() => setDetailsId("")}
          onEdit={() => setEditor(details)}
        />
      )}
      {editor && (
        <TransactionEditor
          transaction={editor === "new" ? undefined : editor}
          onClose={closeEditor}
        />
      )}
    </>
  );
}
