"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  FAMILY_ROLES,
  Family,
  FamilyMemberRole,
  familyRoleLabel,
} from "@/lib/types";
import {
  createFamily,
  getMyFamily,
  joinFamily,
  leaveFamily,
  removeFamilyMember,
  rotateInviteCode,
  setFamilyRole,
} from "@/lib/family";

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Неизвестная ошибка";
}

export default function FamilyPage() {
  const { user } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [createRole, setCreateRole] = useState<FamilyMemberRole>("mom");
  const [joinCode, setJoinCode] = useState("");
  const [joinRole, setJoinRole] = useState<FamilyMemberRole>("mom");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setFamily(await getMyFamily());
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = family?.owner_id === user?.id;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await createFamily(newName.trim(), createRole);
      await load();
      setNewName("");
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      await joinFamily(joinCode.trim().toUpperCase(), joinRole);
      await load();
      setJoinCode("");
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    const warn = isOwner
      ? "Вы владелец. При выходе семья будет распущена (участники сохранят свои личные данные). Продолжить?"
      : "Покинуть семью?";
    if (!confirm(warn)) return;
    setBusy(true);
    setError("");
    try {
      await leaveFamily();
      await load();
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Удалить участника из семьи?")) return;
    setBusy(true);
    setError("");
    try {
      await removeFamilyMember(id);
      await load();
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleChangeRole(userId: string, role: FamilyMemberRole) {
    setBusy(true);
    setError("");
    try {
      await setFamilyRole(userId, role);
      await load();
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!family) return;
    try {
      await navigator.clipboard.writeText(family.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function handleRotateCode() {
    if (!confirm("Сгенерировать новый код? Старый перестанет действовать.")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await rotateInviteCode();
      await load();
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-stone-500">Загрузка…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Семья 👨‍👩‍👧</h1>
        <p className="text-stone-500">
          Объединитесь с близкими: общий дневник и рекомендации по ужину для
          всей семьи.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!family ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleCreate} className="card space-y-4">
            <h2 className="font-semibold">Создать семью</h2>
            <p className="text-sm text-stone-500">
              Вы станете владельцем и сможете приглашать участников по коду.
            </p>
            <div>
              <label htmlFor="famName" className="label">
                Название семьи
              </label>
              <input
                id="famName"
                type="text"
                required
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Например: Семья Ивановых"
              />
            </div>
            <div>
              <label htmlFor="createRole" className="label">
                Ваша роль в семье
              </label>
              <select
                id="createRole"
                className="input"
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as FamilyMemberRole)}
              >
                {FAMILY_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.emoji} {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Создаём…" : "Создать семью"}
            </button>
          </form>

          <form onSubmit={handleJoin} className="card space-y-4">
            <h2 className="font-semibold">Присоединиться</h2>
            <p className="text-sm text-stone-500">
              Введите код-приглашение, который дал владелец семьи.
            </p>
            <div>
              <label htmlFor="joinCode" className="label">
                Код-приглашение
              </label>
              <input
                id="joinCode"
                type="text"
                required
                className="input uppercase"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="ABCD1234"
              />
            </div>
            <div>
              <label htmlFor="joinRole" className="label">
                Ваша роль в семье
              </label>
              <select
                id="joinRole"
                className="input"
                value={joinRole}
                onChange={(e) => setJoinRole(e.target.value as FamilyMemberRole)}
              >
                {FAMILY_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.emoji} {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Вступаем…" : "Присоединиться"}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{family.name}</h2>
                <p className="text-sm text-stone-500">
                  {family.members.length} участник(ов)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-stone-100 px-3 py-1.5 font-mono text-sm tracking-wider">
                  {family.invite_code}
                </span>
                <button
                  onClick={copyCode}
                  className="btn-secondary !px-3 !py-1.5"
                >
                  {copied ? "Скопировано" : "Копировать"}
                </button>
                {isOwner && (
                  <button
                    onClick={handleRotateCode}
                    disabled={busy}
                    className="btn-secondary !px-3 !py-1.5"
                  >
                    Обновить код
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-stone-500">
              Поделитесь кодом с близкими — они вступят на странице «Семья».
            </p>
          </div>

          <div className="card">
            <h3 className="mb-3 font-semibold">Участники</h3>
            <ul className="divide-y divide-stone-100">
              {family.members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {m.full_name || m.email || "Участник"}
                      {m.user_id === user?.id && " (вы)"}
                    </div>
                    <div className="truncate text-xs text-stone-500">
                      {m.email}
                      {m.age != null && ` · ${m.age} лет`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.role === "owner"
                          ? "bg-brand-50 text-brand-700"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {m.role === "owner" ? "Владелец" : "Участник"}
                    </span>

                    {isOwner ? (
                      <select
                        className="input !w-auto !py-1 text-sm"
                        value={m.member_role}
                        disabled={busy}
                        onChange={(e) =>
                          handleChangeRole(
                            m.user_id,
                            e.target.value as FamilyMemberRole,
                          )
                        }
                      >
                        {FAMILY_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.emoji} {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-stone-600">
                        {familyRoleLabel(m.member_role)}
                      </span>
                    )}

                    {isOwner && m.role !== "owner" && (
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        disabled={busy}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/advice" className="btn-primary">
              Рекомендация по ужину 🍽️
            </Link>
            <button
              onClick={handleLeave}
              disabled={busy}
              className="btn-secondary text-red-600"
            >
              Покинуть семью
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
