"use client";

export function Spinner() {
  return (
    <div
      className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600"
      role="status"
      aria-label="Загрузка"
    />
  );
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}
