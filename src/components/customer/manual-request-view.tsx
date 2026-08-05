// ============================================================================
// File: src/components/customer/manual-request-view.tsx
// Purpose: Customer types a list of medicines they want + notes. Stored as
//          ManualRequest. Helper text + success state.
// Role: Fallback for when a customer can't find a medicine in the catalog.
// ============================================================================

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Pill,
  Lightbulb,
  Clock,
  MessageSquare,
  ChevronRight,
  PackageCheck,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { useRequireAuth } from "./use-require-auth";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { formatDateTime } from "@/lib/format";

// ---------------------------------------------------------------------------
// Manual request history item shape (returned by GET /api/manual-requests).
// ---------------------------------------------------------------------------
interface ManualRequestHistoryItem {
  id: string;
  status: string;
  medicineList: string;
  notes: string | null;
  adminNotes: string | null;
  convertedOrderId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Status metadata for the manual request history cards. Mirrors the
// prescription history styling so the two flows feel consistent.
// ---------------------------------------------------------------------------
const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  verified: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  converted: { label: "Converted", className: "bg-sky-100 text-sky-700" },
  rejected: { label: "Rejected", className: "bg-rose-100 text-rose-700" },
};

export function ManualRequestView() {
  const navigate = useUI((s) => s.navigate);
  const { customer } = useRequireAuth();
  const qc = useQueryClient();
  const [medicineList, setMedicineList] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Prefill bridge: the Health Assistant widget writes the user's last chat
  // query to `pms:medicine-request-prefill` when they click "Request This
  // Medicine". We pick it up here, drop it into the medicine list field, and
  // clear the key so it doesn't re-prefill on subsequent visits.
  useEffect(() => {
    try {
      const prefill = window.localStorage.getItem("pms:medicine-request-prefill");
      if (prefill && prefill.trim().length > 0) {
        setMedicineList(prefill.trim());
        window.localStorage.removeItem("pms:medicine-request-prefill");
      }
    } catch {
      // localStorage unavailable (private mode) — silently ignore.
    }
  }, []);

  // Fetch the customer's manual request history so we can show it under the
  // form (status, request date, requested medicines, admin notes).
  const { data: history } = useQuery<{ items: ManualRequestHistoryItem[]; total: number }>({
    queryKey: ["customer", "manual-requests"],
    queryFn: () => api("/api/manual-requests"),
    enabled: !!customer,
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post("/api/manual-requests", { medicineList, notes }),
    onSuccess: () => {
      toast.success("Request submitted successfully");
      setSubmitted(true);
      // Refresh the history so the new entry shows up if the customer
      // navigates back to the request form.
      qc.invalidateQueries({ queryKey: ["customer", "manual-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auth gate — must run AFTER all hooks
  if (!customer) {
    // useRequireAuth handles redirect in an effect
    return null;
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <Card className="items-center gap-3 p-6 text-center">
          <CheckCircle2 className="size-14 text-emerald-600" />
          <h2 className="text-xl font-bold">Request submitted!</h2>
          <p className="text-sm text-muted-foreground">
            Thank you. Our pharmacist will check availability and contact you shortly
            with prices and delivery details.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => navigate({ name: "shop" })} className="gap-2">
              Continue shopping <ArrowRight className="size-4" />
            </Button>
            <Button onClick={() => navigate({ name: "account" })} variant="outline">
              Go to account
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Request Medicines</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Can&apos;t find what you need? List the medicines below and our pharmacist
          will get back to you with prices and availability.
        </p>
      </div>

      <Card className="mb-4 gap-2 border-teal-200 bg-teal-50 p-3 py-3">
        <div className="flex items-start gap-2 text-xs text-teal-900">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-teal-600" />
          <div>
            <p className="font-semibold">Tips for accurate service</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>One medicine per line for clarity.</li>
              <li>Mention brand name + composition if you know it (e.g. &quot;Crocin 500mg / Paracetamol&quot;).</li>
              <li>Mention pack size or quantity (e.g. &quot;1 strip of 10&quot;).</li>
              <li>For prescription medicines, you can also upload a prescription separately.</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="gap-3 p-4">
        <div>
          <Label htmlFor="med-list" className="text-sm font-semibold">
            Medicine list <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="med-list"
            placeholder={
              "e.g.\nCrocin 500mg — 1 strip\nAzithromycin 500mg — 1 strip\nVitamin C 500mg — 1 bottle"
            }
            value={medicineList}
            onChange={(e) => setMedicineList(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {medicineList.trim().split("\n").filter(Boolean).length} medicine(s) listed
          </p>
        </div>

        <div>
          <Label htmlFor="med-notes" className="text-sm font-semibold">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="med-notes"
            placeholder="Any preferences, delivery instructions, or specific requirements..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
      </Card>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          className="flex-1 gap-2"
          onClick={() => submitMutation.mutate()}
          disabled={medicineList.trim().length < 3 || submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Submitting...
            </>
          ) : (
            <>
              <ClipboardList className="size-4" /> Submit request
            </>
          )}
        </Button>
        <Button variant="outline" size="lg" onClick={() => navigate({ name: "prescription" })} className="gap-2">
          <Pill className="size-4" /> Upload prescription instead
        </Button>
      </div>

      {/* Manual request history — shows every request the customer has
          submitted, with status, date, requested medicines, and admin notes. */}
      {history && history.items.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Request History</h2>
            <Badge variant="secondary" className="ml-1">{history.total}</Badge>
          </div>
          <div className="space-y-3">
            {history.items.map((r) => {
              const meta = STATUS_META[r.status] ?? {
                label: r.status,
                className: "bg-muted text-muted-foreground",
              };
              // Show the requested medicines as a list of lines (one per line
              // in the original medicineList field).
              const medicineLines = r.medicineList
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{r.id.slice(-8).toUpperCase()}
                    </span>
                    <Badge className={meta.className}>{meta.label}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                    </span>
                  </div>

                  {/* Requested medicines */}
                  {medicineLines.length > 0 && (
                    <div className="mt-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <PackageCheck className="size-3.5" />
                        Requested medicines
                      </p>
                      <ul className="mt-1.5 space-y-0.5 text-sm">
                        {medicineLines.slice(0, 6).map((line, i) => (
                          <li key={i} className="font-mono text-xs">
                            {line}
                          </li>
                        ))}
                        {medicineLines.length > 6 && (
                          <li className="text-xs italic text-muted-foreground">
                            +{medicineLines.length - 6} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Admin notes — show when the pharmacist has reviewed. */}
                  {r.adminNotes && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-2 text-xs">
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">Pharmacist&apos;s note</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{r.adminNotes}</p>
                      </div>
                    </div>
                  )}

                  {/* Customer's own notes (if any) — secondary. */}
                  {r.notes && (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      Your note: {r.notes}
                    </p>
                  )}

                  {/* If converted to an order, link to orders page. */}
                  {r.status === "converted" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-auto gap-1 p-0 text-primary"
                      onClick={() => navigate({ name: "orders" })}
                    >
                      View your orders <ChevronRight className="size-3.5" />
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
