import { useEffect, useState } from "react";
import { bookingAPI } from "@/lib/api";
import { Receipt, ShieldAlert } from "lucide-react";
import MagicBentoCard from "@/components/ui/MagicBentoCard";
import AnimatedList from "@/components/ui/AnimatedList";

interface BookingHistoryItem {
  booking_id: string;
  ticket_id?: string | null;
  station_id?: string | null;
  charger_id?: string | null;
  station_name?: string | null;
  charger_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  total_amount?: number | string | null;
  booking_status?: string | null;
  created_at?: string | null;
  was_overridden?: boolean;
}

const getStatusBadge = (status?: string | null) => {
  switch (status) {
    case "COMPLETED":
      return "bg-accent text-primary";
    case "NO_SHOW":
      return "bg-red-100 text-red-700";
    case "ACTIVE":
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700";
    case "GRACE":
      return "bg-amber-100 text-amber-800";
    case "UPCOMING":
    case "PAID":
      return "bg-muted text-muted-foreground";
    case "CANCELLED":
      return "bg-zinc-100 text-zinc-700";
    case "OVERRIDDEN":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const formatMoney = (v: BookingHistoryItem["total_amount"]) => {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isFinite(n)) return `₹${n.toFixed(2)}`;
  return String(v);
};

const TransactionsPage = () => {
  const [items, setItems] = useState<BookingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const refresh = async () => {
    const res = await bookingAPI.getMyBookingHistory();
    setItems(res.data ?? []);
  };

  useEffect(() => {
    const run = async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const canCancel = (status?: string | null) => status === "UPCOMING" || status === "GRACE";

  const onCancel = async (bookingId: string) => {
    setCancellingId(bookingId);
    try {
      await bookingAPI.cancelBooking(bookingId);
      await refresh();
    } finally {
      setCancellingId(null);
    }
  };

  /* Build display strings for AnimatedList */
  const listItems = items.map((b) => {
    const status = b.booking_status || "—";
    const start = b.start_time ? new Date(b.start_time) : null;
    const dateStr = start ? start.toLocaleDateString() : "";
    const timeStr = start
      ? `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${
          b.end_time ? new Date(b.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""
        }`
      : "";
    return `${b.ticket_id || "—"}  ·  ${status}  ·  ${dateStr} ${timeStr}  ·  ${formatMoney(b.total_amount)}`;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
          <Receipt className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">Your payment & booking history</p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading transactions...</p>
      ) : items.length === 0 ? (
        <MagicBentoCard enableSpotlight>
          <div className="p-10 text-center text-muted-foreground">No history found.</div>
        </MagicBentoCard>
      ) : (
        <>
          {/* Overridden booking notification banner */}
          {items.some(b => b.was_overridden || b.booking_status === "OVERRIDDEN") && (
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-800">Booking Overridden by Emergency Vehicle</p>
                <p className="text-xs text-purple-700 mt-1">
                  One or more of your bookings were overridden because an emergency vehicle required the slot.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Animated scrollable list */}
            <div className="lg:col-span-1">
              <MagicBentoCard enableSpotlight>
                <div className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3 px-2">All Transactions ({items.length})</p>
                  <AnimatedList
                    items={listItems}
                    onItemSelect={(_item, idx) => setSelectedIdx(idx)}
                    showGradients={true}
                    displayScrollbar={false}
                    initialSelectedIndex={0}
                    className=""
                  />
                </div>
              </MagicBentoCard>
            </div>

            {/* Right: Detail table */}
            <div className="lg:col-span-2">
              <MagicBentoCard enableParticles={false} enableSpotlight>
                <div className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Ticket</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Window</th>
                        <th className="px-4 py-3 text-left">Amount</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((b, idx) => {
                        const status = b.booking_status || "—";
                        const start = b.start_time ? new Date(b.start_time) : null;
                        const end = b.end_time ? new Date(b.end_time) : null;
                        const isHighlighted = idx === selectedIdx;
                        return (
                          <tr
                            key={b.booking_id}
                            className={`border-t border-border transition align-top cursor-pointer ${
                              isHighlighted ? "bg-accent/30" : "hover:bg-muted/40"
                            }`}
                            onClick={() => setSelectedIdx(idx)}
                          >
                            <td className="px-4 py-3 font-mono whitespace-nowrap">{b.ticket_id || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(status)}`}>{status}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {start && end ? (
                                <div>
                                  <div>{start.toLocaleDateString()}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </div>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{formatMoney(b.total_amount)}</td>
                            <td className="px-4 py-3">
                              {canCancel(status) ? (
                                <button
                                  className="px-3 py-1 rounded-md bg-destructive text-destructive-foreground text-xs disabled:opacity-60"
                                  disabled={cancellingId === b.booking_id}
                                  onClick={(e) => { e.stopPropagation(); onCancel(b.booking_id); }}
                                >
                                  {cancellingId === b.booking_id ? "Cancelling…" : "Cancel"}
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </MagicBentoCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionsPage;
