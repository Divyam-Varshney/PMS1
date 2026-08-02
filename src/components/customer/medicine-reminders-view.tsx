// ============================================================================
// File: src/components/customer/medicine-reminders-view.tsx
// Purpose: Customer-facing medicine reminder manager. Lets logged-in
//          customers create, edit, pause, and delete reminders to take
//          their medicines on schedule. Uses Framer Motion for list
//          animations and TanStack Query for the API.
// Role: Accessible from the account page or bottom nav as the "reminders"
//       view. Backed by /api/customer/reminders and /api/customer/reminders/[id].
// ============================================================================

"use client";

import { useRequireAuth } from "./use-require-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BellPlus,
  Pill,
  Clock,
  Trash2,
  Pencil,
  Pause,
  Play,
  Plus,
  X,
  ChevronLeft,
  Loader2,
  CalendarClock,
  AlarmClock,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk, MedicineReminder, Product } from "./api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { formatDate } from "@/lib/format";

type Freq = "daily" | "twice-daily" | "weekly" | "custom";

const FREQ_LABEL: Record<Freq, string> = {
  daily: "Once daily",
  "twice-daily": "Twice daily",
  weekly: "Weekly",
  custom: "Custom",
};

// Default times per frequency — used when adding a new reminder.
function defaultTimes(freq: Freq): string[] {
  if (freq === "daily") return ["08:00"];
  if (freq === "twice-daily") return ["08:00", "20:00"];
  if (freq === "weekly") return ["09:00"];
  return ["08:00"];
}

// Parse the JSON-encoded times string into a string[] safely.
function parseTimes(times: string): string[] {
  try {
    const parsed = JSON.parse(times);
    if (Array.isArray(parsed)) {
      return parsed.filter((t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t));
    }
  } catch {
    /* ignore */
  }
  return [];
}

// Convert "HH:MM" to a 12-hour display like "8:00 AM".
function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  if (!Number.isFinite(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
}

interface FormState {
  productName: string;
  dosage: string;
  frequency: Freq;
  times: string[];
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: FormState = {
  productName: "",
  dosage: "",
  frequency: "daily",
  times: ["08:00"],
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
};

export function MedicineRemindersView() {
  const { customer, isLoading } = useRequireAuth();
  const back = useUI((s) => s.back);
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Fetch the customer's reminders.
  const { data, isFetching } = useQuery({
    queryKey: qk.reminders,
    queryFn: () => api<{ items: MedicineReminder[] }>("/api/customer/reminders"),
    enabled: !!customer,
  });
  const reminders = data?.items ?? [];

  // Product autocomplete — fetches from the catalog as the user types the
  // product name. Used to suggest real product names but the customer can
  // also type a custom name (e.g., "Vitamin D tablet").
  const [productQuery, setProductQuery] = useState("");
  const debouncedQuery = useDebounced(productQuery, 250);
  const { data: productSuggestions } = useQuery({
    queryKey: ["customer", "reminder-product-search", debouncedQuery],
    queryFn: () =>
      api<{ items: Product[] }>(
        `/api/catalog/products?query=${encodeURIComponent(debouncedQuery)}&limit=5`
      ),
    enabled: debouncedQuery.length >= 2 && dialogOpen,
    staleTime: 30 * 1000,
  });
  const suggestions = productSuggestions?.items ?? [];

  // Create / update mutation — single function that POSTs or PATCHes.
  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const body = {
        productName: payload.productName.trim(),
        dosage: payload.dosage.trim() || null,
        frequency: payload.frequency,
        times: payload.times,
        startDate: payload.startDate,
        endDate: payload.endDate || null,
      };
      if (editingId) {
        return api.patch(`/api/customer/reminders/${editingId}`, body);
      }
      return api.post<{ id: string }>("/api/customer/reminders", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reminders });
      toast.success(editingId ? "Reminder updated" : "Reminder created");
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setProductQuery("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Toggle pause/resume — uses PATCH with just isActive.
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/customer/reminders/${id}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reminders });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete — confirm via window.confirm (simple + accessible enough).
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/customer/reminders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reminders });
      toast.success("Reminder deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setProductQuery("");
    setDialogOpen(true);
  };

  const openEdit = (r: MedicineReminder) => {
    setEditingId(r.id);
    setForm({
      productName: r.productName,
      dosage: r.dosage ?? "",
      frequency: (r.frequency as Freq) ?? "daily",
      times: parseTimes(r.times),
      startDate: r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : EMPTY_FORM.startDate,
      endDate: r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : "",
    });
    setProductQuery(r.productName);
    setDialogOpen(true);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productName.trim()) {
      toast.error("Please enter the medicine name");
      return;
    }
    if (form.times.length === 0) {
      toast.error("Please add at least one time");
      return;
    }
    saveMutation.mutate(form);
  };

  // When frequency changes, reset times to the defaults (unless the user has
  // already customized — they can re-edit afterwards).
  const onFrequencyChange = (freq: Freq) => {
    setForm((f) => ({ ...f, frequency: freq, times: defaultTimes(freq) }));
  };

  const addTime = () => {
    setForm((f) => ({ ...f, times: [...f.times, "12:00"] }));
  };

  const updateTime = (idx: number, value: string) => {
    setForm((f) => ({ ...f, times: f.times.map((t, i) => (i === idx ? value : t)) }));
  };

  const removeTime = (idx: number) => {
    setForm((f) => ({ ...f, times: f.times.filter((_, i) => i !== idx) }));
  };

  const pickSuggestion = (p: Product) => {
    setForm((f) => ({ ...f, productName: p.name }));
    setProductQuery(p.name);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card className="h-48 animate-pulse bg-accent" />
      </div>
    );
  }

  if (!customer) {
    // useRequireAuth handles redirect in an effect
    return null;
  }

  const activeReminders = reminders.filter((r) => r.isActive);
  const pausedReminders = reminders.filter((r) => !r.isActive);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={back} aria-label="Back">
            <ChevronLeft className="size-5" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <AlarmClock className="size-5 text-primary" /> Medicine Reminders
            </h1>
            <p className="text-xs text-muted-foreground">
              Never miss a dose — set up daily or weekly reminders.
            </p>
          </div>
        </div>
        <Button onClick={openAdd} className="gap-1.5" size="sm">
          <BellPlus className="size-4" /> <span className="hidden sm:inline">Add Reminder</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Stats strip */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatPill label="Total" value={reminders.length} tint="text-foreground" />
        <StatPill label="Active" value={activeReminders.length} tint="text-emerald-600" />
        <StatPill label="Paused" value={pausedReminders.length} tint="text-amber-600" />
      </div>

      {/* Empty state */}
      {!isFetching && reminders.length === 0 && (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <AlarmClock className="size-7" />
          </div>
          <div>
            <h2 className="text-base font-semibold">No reminders yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add one to never miss a dose. We&apos;ll keep track of your medicine schedule.
            </p>
          </div>
          <Button onClick={openAdd} className="mt-1 gap-1.5">
            <Plus className="size-4" /> Add your first reminder
          </Button>
        </Card>
      )}

      {/* Reminder list — active first, then paused, separated by a header */}
      <AnimatePresence mode="popLayout">
        {activeReminders.length > 0 && (
          <motion.div layout className="space-y-3">
            {activeReminders.map((r) => (
              <ReminderCard
                key={r.id}
                reminder={r}
                onEdit={() => openEdit(r)}
                onToggle={() => toggleMutation.mutate({ id: r.id, isActive: false })}
                onDelete={() => {
                  if (confirm(`Delete the reminder for "${r.productName}"?`)) {
                    deleteMutation.mutate(r.id);
                  }
                }}
              />
            ))}
          </motion.div>
        )}

        {pausedReminders.length > 0 && (
          <motion.div layout className="mt-6">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Pause className="size-3.5" /> Paused
            </p>
            <div className="space-y-3">
              {pausedReminders.map((r) => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  onEdit={() => openEdit(r)}
                  onToggle={() => toggleMutation.mutate({ id: r.id, isActive: true })}
                  onDelete={() => {
                    if (confirm(`Delete the reminder for "${r.productName}"?`)) {
                      deleteMutation.mutate(r.id);
                    }
                  }}
                  muted
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm(EMPTY_FORM); setProductQuery(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellPlus className="size-5 text-primary" />
              {editingId ? "Edit Reminder" : "Add Reminder"}
            </DialogTitle>
            <DialogDescription>
              Set up a schedule for taking this medicine. You can pause or edit later.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Product name (with autocomplete) */}
            <div className="space-y-1.5">
              <Label htmlFor="rm-product">Medicine name</Label>
              <Input
                id="rm-product"
                value={form.productName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, productName: e.target.value }));
                  setProductQuery(e.target.value);
                }}
                placeholder="e.g., Metformin 500mg"
                required
                autoComplete="off"
              />
              {/* Autocomplete suggestions */}
              {suggestions.length > 0 && form.productName !== "" && (
                <div className="relative">
                  <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => pickSuggestion(p)}
                        className="flex w-full items-center gap-2 border-b px-3 py-1.5 text-left text-sm last:border-b-0 hover:bg-accent"
                      >
                        <Pill className="size-3.5 shrink-0 text-emerald-600" />
                        <span className="flex-1 truncate">{p.name}</span>
                        {p.brand?.name && (
                          <span className="text-[10px] text-muted-foreground">{p.brand.name}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dosage */}
            <div className="space-y-1.5">
              <Label htmlFor="rm-dosage">Dosage <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="rm-dosage"
                value={form.dosage}
                onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
                placeholder="e.g., 1 tablet after food"
                maxLength={100}
              />
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <Label htmlFor="rm-freq">Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => onFrequencyChange(v as Freq)}>
                <SelectTrigger id="rm-freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Once daily</SelectItem>
                  <SelectItem value="twice-daily">Twice daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Times — array of "HH:MM" inputs */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Times</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addTime}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Plus className="size-3" /> Add time
                </Button>
              </div>
              <div className="space-y-2">
                {form.times.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={t}
                      onChange={(e) => updateTime(i, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTime(i)}
                      disabled={form.times.length === 1}
                      aria-label="Remove time"
                      className="size-9 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Start + end dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rm-start">Start date</Label>
                <Input
                  id="rm-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rm-end">End date <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="rm-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM); setProductQuery(""); }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="gap-1.5">
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BellPlus className="size-4" />
                )}
                {editingId ? "Save changes" : "Create reminder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReminderCard — single reminder row.
// ---------------------------------------------------------------------------
function ReminderCard({
  reminder,
  onEdit,
  onToggle,
  onDelete,
  muted,
}: {
  reminder: MedicineReminder;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  muted?: boolean;
}) {
  const times = parseTimes(reminder.times);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={muted ? "p-4 opacity-70" : "p-4"}>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Pill className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight">{reminder.productName}</p>
                {reminder.dosage && (
                  <p className="text-xs text-muted-foreground">{reminder.dosage}</p>
                )}
              </div>
              <Badge
                variant="outline"
                className={
                  reminder.isActive
                    ? "gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                }
              >
                {reminder.isActive ? (
                  <>
                    <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                  </>
                ) : (
                  <>
                    <span className="size-1.5 rounded-full bg-amber-500" /> Paused
                  </>
                )}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3" /> {FREQ_LABEL[reminder.frequency]}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {times.length > 0 ? times.map(formatTime).join(" · ") : "—"}
              </span>
            </div>

            <div className="mt-1 text-[11px] text-muted-foreground">
              Started {formatDate(reminder.startDate)}
              {reminder.endDate && ` · Until ${formatDate(reminder.endDate)}`}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="gap-1 text-xs"
          >
            {reminder.isActive ? (
              <>
                <Pause className="size-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="size-3.5" /> Resume
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="gap-1 text-xs"
          >
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="gap-1 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function StatPill({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <Card className="flex flex-col items-start gap-0.5 p-3">
      <span className={`text-xl font-bold leading-none ${tint}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// useDebounced — small inline hook for the autocomplete query.
// ---------------------------------------------------------------------------
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
