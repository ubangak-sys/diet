"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getMyFamily } from "@/lib/family";
import type { Family } from "@/lib/types";

interface FamilyContextValue {
  family: Family | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextValue>({
  family: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const f = await getMyFamily();
      setFamily(f);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки семьи");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <FamilyContext.Provider value={{ family, loading, error, refresh }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  return useContext(FamilyContext);
}
