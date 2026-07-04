"use client";

import { useEffect, useMemo, useState } from "react";
import LedgerForm from "./LedgerForm";
import LedgerTable from "./LedgerTable";

type LedgerInput = {
  name: string;
  group: string;
  openingBalance: number;
  mobile: string;
  email: string;
  gst: string;
  address: string;
};

type Ledger = LedgerInput & {
  id: string;
};

type LedgerManagerProps = {
  searchQuery?: string;
};

const STORAGE_KEY = "VertexERP_ledgers";
const LEDGERS_EVENT = "VertexERP-ledgers-updated";

export default function LedgerManager({
  searchQuery = "",
}: LedgerManagerProps) {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedLedgers = window.localStorage.getItem(STORAGE_KEY);

      if (!savedLedgers) {
        setLedgers([]);
        return;
      }

      const parsedLedgers = JSON.parse(savedLedgers);

      setLedgers(Array.isArray(parsedLedgers) ? parsedLedgers : []);
    } catch {
      setLedgers([]);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ledgers));
    window.dispatchEvent(new Event(LEDGERS_EVENT));
  }, [ledgers, isLoaded]);

  const filteredLedgers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return ledgers;
    }

    return ledgers.filter((ledger) => {
      const searchableText = [
        ledger.name,
        ledger.group,
        ledger.mobile,
        ledger.email,
        ledger.gst,
        ledger.address,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [ledgers, searchQuery]);

  function addLedger(ledgerInput: LedgerInput) {
    const newLedger: Ledger = {
      ...ledgerInput,
      id: crypto.randomUUID(),
    };

    setLedgers((currentLedgers) => [newLedger, ...currentLedgers]);
  }

  function deleteLedger(ledgerId: string) {
    setLedgers((currentLedgers) =>
      currentLedgers.filter((ledger) => ledger.id !== ledgerId)
    );
  }

  return (
    <>
      <LedgerForm onAddLedger={addLedger} />

      <LedgerTable
        ledgers={filteredLedgers}
        onDeleteLedger={deleteLedger}
      />
    </>
  );
}