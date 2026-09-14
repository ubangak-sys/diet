"use client";

import { AuthProvider } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { FamilyProvider } from "@/components/FamilyProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <RequireAuth>
        <FamilyProvider>
          <AppShell>{children}</AppShell>
        </FamilyProvider>
      </RequireAuth>
    </AuthProvider>
  );
}
