import type { Migration } from "./runner.js";

/**
 * Recorded buy and sell transactions. A payment method is what the person
 * reported; it is not a verified payment or a settlement record.
 */
export const transactions: Migration = {
  version: 8,
  name: "transactions",
  statements: [
    `CREATE TABLE transactions (
      id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES organizations(id), owner_id text NOT NULL REFERENCES users(id),
      version integer NOT NULL DEFAULT 1 CHECK (version > 0), sample boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, id),
      reference text NOT NULL, kind text NOT NULL CHECK (kind IN ('buy','sell')), crop text NOT NULL,
      quantity_kg double precision NOT NULL CHECK (quantity_kg > 0),
      unit_price_ugx integer NOT NULL CHECK (unit_price_ugx > 0),
      total_ugx bigint NOT NULL CHECK (total_ugx > 0),
      transaction_date date NOT NULL, buyer text NOT NULL, seller text NOT NULL, farm_id text,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','in_transit','delivered','cancelled')),
      payment_method text NOT NULL DEFAULT 'not_recorded' CHECK (payment_method IN ('not_recorded','mobile_money','bank_transfer','cash','cheque')),
      payment_provider text NOT NULL DEFAULT '', recorded_by text NOT NULL, notes text NOT NULL DEFAULT '',
      UNIQUE (tenant_id, reference),
      FOREIGN KEY (tenant_id, farm_id) REFERENCES farms(tenant_id, id)
    )`,
    `CREATE INDEX transactions_scope_idx ON transactions(tenant_id, owner_id, transaction_date DESC, id)`,
  ],
};
