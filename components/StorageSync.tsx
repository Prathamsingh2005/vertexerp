"use client";

import { useEffect } from "react";

type StorageGroup = {
  name:
    | "products"
    | "sales"
    | "purchases"
    | "payments"
    | "expenses"
    | "ledgers"
    | "companies";
  aliases: string[];
  events: string[];
};

const STORAGE_GROUPS: StorageGroup[] = [
  {
    name: "products",
    aliases: ["VertexERP_products", "smarterp_products"],
    events: [
      "VertexERP-products-updated",
      "smarterp-products-updated",
    ],
  },
  {
    name: "sales",
    aliases: ["VertexERP_sales", "smarterp_sales"],
    events: [
      "VertexERP-sales-updated",
      "smarterp-sales-updated",
    ],
  },
  {
    name: "purchases",
    aliases: ["VertexERP_purchases", "smarterp_purchases"],
    events: [
      "VertexERP-purchases-updated",
      "smarterp-purchases-updated",
    ],
  },
  {
    name: "payments",
    aliases: ["VertexERP_payments", "smarterp_payments"],
    events: [
      "VertexERP-payments-updated",
      "smarterp-payments-updated",
    ],
  },
  {
    name: "expenses",
    aliases: ["VertexERP_expenses", "smarterp_expenses"],
    events: [
      "VertexERP-expenses-updated",
      "smarterp-expenses-updated",
    ],
  },
  {
    name: "ledgers",
    aliases: ["VertexERP_ledgers", "smarterp_ledgers"],
    events: [
      "VertexERP-ledgers-updated",
      "smarterp-ledgers-updated",
    ],
  },
  {
    name: "companies",
    aliases: ["VertexERP_companies", "smarterp_companies"],
    events: [
      "VertexERP-companies-updated",
      "smarterp-companies-updated",
    ],
  },
];

const MIGRATION_KEY = "vertexerp_storage_migration_v1_completed";

const OLD_DEMO_PARTIES = new Set([
  "rahul traders",
  "sharma distributors",
]);

function readArray(value: string | null): Record<string, unknown>[] {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function isOldDemoRecord(
  groupName: StorageGroup["name"],
  record: Record<string, unknown>
) {
  const partyName =
    groupName === "ledgers"
      ? String(record.name || "")
      : [
          record.customerName,
          record.supplierName,
          record.partyName,
        ]
          .filter(Boolean)
          .join(" ");

  return OLD_DEMO_PARTIES.has(partyName.trim().toLowerCase());
}

function getRecordKey(
  record: Record<string, unknown>,
  index: number
) {
  if (record.id) {
    return `id-${String(record.id)}`;
  }

  return [
    record.invoiceNumber,
    record.billNumber,
    record.name,
    record.customerName,
    record.supplierName,
    record.partyName,
    record.date,
    record.grandTotal,
    record.amount,
    index,
  ].join("|");
}

function mergeRecords(
  groupName: StorageGroup["name"],
  values: Array<string | null>
) {
  const allRecords = values.flatMap((value) => readArray(value));

  const uniqueRecords = new Map<string, Record<string, unknown>>();

  allRecords.forEach((record, index) => {
    if (isOldDemoRecord(groupName, record)) {
      return;
    }

    const recordKey = getRecordKey(record, index);

    if (!uniqueRecords.has(recordKey)) {
      uniqueRecords.set(recordKey, record);
    }
  });

  return Array.from(uniqueRecords.values());
}

export default function StorageSync() {
  useEffect(() => {
    const storage = window.localStorage;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    const groupByKey = new Map<string, StorageGroup>();

    STORAGE_GROUPS.forEach((group) => {
      group.aliases.forEach((key) => {
        groupByKey.set(key, group);
      });
    });

    function dispatchUpdateEvents(group: StorageGroup) {
      group.events.forEach((eventName) => {
        window.dispatchEvent(new Event(eventName));
      });
    }

    function writeGroupData(
      group: StorageGroup,
      value: string
    ) {
      group.aliases.forEach((key) => {
        originalSetItem.call(storage, key, value);
      });

      dispatchUpdateEvents(group);
    }

    function backupExistingData() {
      STORAGE_GROUPS.forEach((group) => {
        group.aliases.forEach((key) => {
          const currentValue = storage.getItem(key);
          const backupKey = `vertexerp_backup_${key}`;

          if (
            currentValue !== null &&
            storage.getItem(backupKey) === null
          ) {
            originalSetItem.call(storage, backupKey, currentValue);
          }
        });
      });
    }

    function runOneTimeMigration() {
      if (storage.getItem(MIGRATION_KEY) === "completed") {
        return;
      }

      backupExistingData();

      STORAGE_GROUPS.forEach((group) => {
        const mergedData = mergeRecords(
          group.name,
          group.aliases.map((key) => storage.getItem(key))
        );

        writeGroupData(group, JSON.stringify(mergedData));
      });

      originalSetItem.call(storage, MIGRATION_KEY, "completed");
    }

    runOneTimeMigration();

    let isSyncing = false;

    Storage.prototype.setItem = function (
      this: Storage,
      key: string,
      value: string
    ) {
      originalSetItem.call(this, key, value);

      if (this !== storage || isSyncing) {
        return;
      }

      const group = groupByKey.get(key);

      if (!group) {
        return;
      }

      isSyncing = true;

      try {
        writeGroupData(group, value);
      } finally {
        isSyncing = false;
      }
    };

    Storage.prototype.removeItem = function (
      this: Storage,
      key: string
    ) {
      originalRemoveItem.call(this, key);

      if (this !== storage || isSyncing) {
        return;
      }

      const group = groupByKey.get(key);

      if (!group) {
        return;
      }

      isSyncing = true;

      try {
        group.aliases.forEach((alias) => {
          originalRemoveItem.call(storage, alias);
        });

        dispatchUpdateEvents(group);
      } finally {
        isSyncing = false;
      }
    };

    return () => {
      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.removeItem = originalRemoveItem;
    };
  }, []);

  return null;
}