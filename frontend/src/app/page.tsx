"use client";

import { FormEvent, useMemo, useState } from "react";

type QRMapping = {
  token: string;
  short_url?: string;
  qr_code_url?: string;
  original_url: string;
  created_at?: string;
  updated_at?: string;
  expires_at: string | null;
  is_deleted?: boolean;
};

type CreateQRResponse = {
  token: string;
  short_url: string;
  qr_code_url: string;
  original_url: string;
};

type QRAnalytics = {
  token: string;
  total_scans: number;
  scans_by_day: Array<{
    date: string;
    count: number;
  }>;
};

const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:8000";

function formatDate(value?: string | null) {
  if (!value) return "None";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toApiDateTime(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function Home() {
  const [createUrl, setCreateUrl] = useState("");
  const [createExpiresAt, setCreateExpiresAt] = useState("");
  const [lookupToken, setLookupToken] = useState("");
  const [updateUrl, setUpdateUrl] = useState("");
  const [updateExpiresAt, setUpdateExpiresAt] = useState("");
  const [mapping, setMapping] = useState<QRMapping | null>(null);
  const [analytics, setAnalytics] = useState<QRAnalytics | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const currentToken = mapping?.token ?? lookupToken.trim();
  const qrImageUrl = mapping
    ? `${
        mapping.qr_code_url ?? `/api/qr/${mapping.token}/image`
      }?ts=${encodeURIComponent(mapping.updated_at ?? mapping.token)}`
    : "";

  const shortUrl = useMemo(() => {
    if (!mapping) return "";
    return mapping.short_url ?? `${backendBaseUrl}/r/${mapping.token}`;
  }, [mapping]);

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      const detail =
        typeof payload?.detail === "string"
          ? payload.detail
          : `Request failed with ${response.status}`;
      throw new Error(detail);
    }

    return payload as T;
  }

  async function refreshAnalytics(token: string) {
    try {
      const nextAnalytics = await requestJson<QRAnalytics>(
        `/api/qr/${token}/analytics`,
      );
      setAnalytics(nextAnalytics);
    } catch {
      setAnalytics(null);
    }
  }

  function hydrateForm(nextMapping: QRMapping) {
    setLookupToken(nextMapping.token);
    setUpdateUrl(nextMapping.original_url);
    setUpdateExpiresAt(toDateTimeLocalValue(nextMapping.expires_at));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      const created = await requestJson<CreateQRResponse>("/api/qr/create", {
        method: "POST",
        body: JSON.stringify({
          url: createUrl,
          expires_at: toApiDateTime(createExpiresAt),
        }),
      });
      const nextMapping = await requestJson<QRMapping>(
        `/api/qr/${created.token}`,
      );

      const hydratedMapping = {
        ...nextMapping,
        short_url: created.short_url,
        qr_code_url: created.qr_code_url,
      };

      setMapping(hydratedMapping);
      hydrateForm(hydratedMapping);
      setMessage("Created QR mapping.");
      await refreshAnalytics(nextMapping.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLookup(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const token = lookupToken.trim();
    if (!token) {
      setError("Please enter a token.");
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      const nextMapping = await requestJson<QRMapping>(`/api/qr/${token}`);
      setMapping(nextMapping);
      hydrateForm(nextMapping);
      setMessage("Loaded QR mapping.");
      await refreshAnalytics(nextMapping.token);
    } catch (err) {
      setMapping(null);
      setAnalytics(null);
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = currentToken.trim();
    if (!token) {
      setError("Create or look up a token first.");
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      const nextMapping = await requestJson<QRMapping>(`/api/qr/${token}`, {
        method: "PATCH",
        body: JSON.stringify({
          url: updateUrl || null,
          expires_at: toApiDateTime(updateExpiresAt),
        }),
      });

      setMapping(nextMapping);
      hydrateForm(nextMapping);
      setMessage("Updated QR mapping.");
      await refreshAnalytics(nextMapping.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    const token = currentToken.trim();
    if (!token) {
      setError("Create or look up a token first.");
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      await requestJson<{ detail: string }>(`/api/qr/${token}`, {
        method: "DELETE",
      });

      setMapping((prev) =>
        prev?.token === token ? { ...prev, is_deleted: true } : null,
      );
      setAnalytics(null);
      setMessage("Deleted QR mapping.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#151817]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-3 border-b border-[#d7ddd4] pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-[#577568]">
              Dynamic QR Code Manager
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[#111312]">
              QR Code Generator
            </h1>
          </div>
          <div className="rounded-md border border-[#c8d1ca] bg-white px-3 py-2 text-sm text-[#54615b]">
            Backend: {backendBaseUrl}
          </div>
        </header>

        {(message || error) && (
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              error
                ? "border-[#e5aaa4] bg-[#fff4f2] text-[#9f2f25]"
                : "border-[#a9d6bd] bg-[#effaf3] text-[#276442]"
            }`}
          >
            {error || message}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[minmax(340px,0.95fr)_minmax(0,1.35fr)]">
          <div className="flex flex-col gap-5">
            <form
              onSubmit={handleCreate}
              className="rounded-lg border border-[#d7ddd4] bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Create</h2>
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#6a766f]">
                  POST
                </span>
              </div>

              <label className="mt-5 block text-sm font-medium text-[#2c3430]">
                URL
                <input
                  value={createUrl}
                  onChange={(event) => setCreateUrl(event.target.value)}
                  placeholder="https://example.com"
                  className="mt-2 h-11 w-full rounded-md border border-[#c9d2cc] bg-white px-3 text-base outline-none transition focus:border-[#24795a] focus:ring-2 focus:ring-[#24795a]/15"
                />
              </label>

              <label className="mt-4 block text-sm font-medium text-[#2c3430]">
                expires_at
                <input
                  value={createExpiresAt}
                  onChange={(event) => setCreateExpiresAt(event.target.value)}
                  type="datetime-local"
                  className="mt-2 h-11 w-full rounded-md border border-[#c9d2cc] bg-white px-3 text-base outline-none transition focus:border-[#24795a] focus:ring-2 focus:ring-[#24795a]/15"
                />
              </label>

              <button
                disabled={isBusy}
                className="mt-5 h-11 w-full rounded-md bg-[#24795a] px-4 text-sm font-semibold text-white transition hover:bg-[#1d6249] disabled:cursor-not-allowed disabled:bg-[#93aaa0]"
              >
                {isBusy ? "Working..." : "Create QR"}
              </button>
            </form>

            <form
              onSubmit={handleLookup}
              className="rounded-lg border border-[#d7ddd4] bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Lookup</h2>
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#6a766f]">
                  GET
                </span>
              </div>

              <label className="mt-5 block text-sm font-medium text-[#2c3430]">
                token
                <input
                  value={lookupToken}
                  onChange={(event) => setLookupToken(event.target.value)}
                  placeholder="abc123xy"
                  className="mt-2 h-11 w-full rounded-md border border-[#c9d2cc] bg-white px-3 font-mono text-base outline-none transition focus:border-[#24795a] focus:ring-2 focus:ring-[#24795a]/15"
                />
              </label>

              <button
                disabled={isBusy}
                className="mt-5 h-11 w-full rounded-md border border-[#24795a] px-4 text-sm font-semibold text-[#1d6249] transition hover:bg-[#edf7f2] disabled:cursor-not-allowed disabled:border-[#aeb9b2] disabled:text-[#7b8982]"
              >
                Load Mapping
              </button>
            </form>

            <form
              onSubmit={handleUpdate}
              className="rounded-lg border border-[#d7ddd4] bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Update</h2>
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#6a766f]">
                  PATCH
                </span>
              </div>

              <label className="mt-5 block text-sm font-medium text-[#2c3430]">
                URL
                <input
                  value={updateUrl}
                  onChange={(event) => setUpdateUrl(event.target.value)}
                  placeholder="https://new-url.com"
                  className="mt-2 h-11 w-full rounded-md border border-[#c9d2cc] bg-white px-3 text-base outline-none transition focus:border-[#24795a] focus:ring-2 focus:ring-[#24795a]/15"
                />
              </label>

              <label className="mt-4 block text-sm font-medium text-[#2c3430]">
                expires_at
                <input
                  value={updateExpiresAt}
                  onChange={(event) => setUpdateExpiresAt(event.target.value)}
                  type="datetime-local"
                  className="mt-2 h-11 w-full rounded-md border border-[#c9d2cc] bg-white px-3 text-base outline-none transition focus:border-[#24795a] focus:ring-2 focus:ring-[#24795a]/15"
                />
              </label>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  disabled={isBusy}
                  className="h-11 rounded-md bg-[#263b34] px-4 text-sm font-semibold text-white transition hover:bg-[#17241f] disabled:cursor-not-allowed disabled:bg-[#93aaa0]"
                >
                  Update
                </button>
                <button
                  disabled={isBusy}
                  type="button"
                  onClick={handleDelete}
                  className="h-11 rounded-md border border-[#c65b50] px-4 text-sm font-semibold text-[#a03a31] transition hover:bg-[#fff1ef] disabled:cursor-not-allowed disabled:border-[#d8b4b0] disabled:text-[#a98a86]"
                >
                  Delete
                </button>
              </div>
            </form>
          </div>

          <div className="flex flex-col gap-5">
            <section className="rounded-lg border border-[#d7ddd4] bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-lg font-semibold">QR Code Preview</h2>
                  <p className="mt-1 text-sm text-[#617069]">
                    Image endpoint renders from the backend short URL.
                  </p>
                </div>
                {mapping?.is_deleted && (
                  <span className="w-fit rounded-md border border-[#e2afa8] bg-[#fff4f2] px-3 py-1 text-sm font-semibold text-[#96372f]">
                    deleted
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[240px_1fr]">
                <div className="flex aspect-square w-full max-w-[240px] items-center justify-center rounded-lg border border-[#cfd8d2] bg-[#f8faf8] p-4">
                  {mapping && !mapping.is_deleted ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrImageUrl}
                      alt={`QR code for ${mapping.token}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="px-4 text-center text-sm text-[#728078]">
                      Create or load a token to preview the QR image.
                    </div>
                  )}
                </div>

                <div className="min-w-0 rounded-md border border-[#e0e5e1] bg-[#fbfcfb] p-4">
                  <InfoRow label="token" value={mapping?.token ?? "None"} mono />
                  <InfoRow label="short_url" value={shortUrl || "None"} mono />
                  <InfoRow
                    label="original_url"
                    value={mapping?.original_url ?? "None"}
                    mono
                  />
                  <InfoRow
                    label="created_at"
                    value={formatDate(mapping?.created_at)}
                  />
                  <InfoRow
                    label="updated_at"
                    value={formatDate(mapping?.updated_at)}
                  />
                  <InfoRow
                    label="expires_at"
                    value={formatDate(mapping?.expires_at)}
                  />
                  <InfoRow
                    label="is_deleted"
                    value={String(mapping?.is_deleted ?? false)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#d7ddd4] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Analytics</h2>
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#6a766f]">
                  GET
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-[160px_1fr]">
                <div className="rounded-md border border-[#d8e0da] bg-[#f8faf8] p-4">
                  <p className="text-sm text-[#617069]">total_scans</p>
                  <p className="mt-2 text-4xl font-semibold text-[#17241f]">
                    {analytics?.total_scans ?? 0}
                  </p>
                </div>
                <div className="rounded-md border border-[#d8e0da] bg-[#f8faf8] p-4">
                  <p className="text-sm font-medium text-[#2c3430]">
                    scans_by_day
                  </p>
                  <div className="mt-3 space-y-2">
                    {analytics?.scans_by_day.length ? (
                      analytics.scans_by_day.map((day) => (
                        <div
                          key={day.date}
                          className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
                        >
                          <span className="font-mono text-[#36433d]">
                            {day.date}
                          </span>
                          <span className="font-semibold">{day.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#728078]">
                        No scan events yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-[#e3e8e4] py-3 last:border-b-0 sm:grid-cols-[120px_1fr]">
      <dt className="text-sm font-medium text-[#617069]">{label}</dt>
      <dd
        className={`min-w-0 break-words text-sm text-[#17241f] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
