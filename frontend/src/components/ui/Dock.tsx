import { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Calendar,
  Receipt,
  Wallet,
  User,
  MapPin,
  Zap,
  Building2,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

/* ─── config ──────────────────────────────────────────────── */
const DOCK_HEIGHT = 68;
const DEFAULT_SIZE = 40;
const MAX_SIZE = 56;
const MAGNIFICATION_DIST = 140;

/* ─── nav definitions by user type ─────────────────────────── */
const userDockItems = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Car, label: "Cars", path: "/user/vehicles" },
  { icon: Calendar, label: "Bookings", path: "/dashboard/bookings" },
  { icon: Receipt, label: "Transactions", path: "/dashboard/transactions" },
  { icon: Wallet, label: "Funds", path: "/dashboard/wallet" },
  { icon: User, label: "Profile", path: "/dashboard/profile" },
];

const adminDockItems = [
  { icon: LayoutDashboard, label: "Home", path: "/admin/dashboard" },
  { icon: MapPin, label: "Stations", path: "/admin/stations" },
  { icon: Zap, label: "Slots", path: "/admin/slots" },
  { icon: Wallet, label: "Wallet", path: "/admin/wallet" },
  { icon: User, label: "Profile", path: "/admin/profile" },
];

const superadminDockItems = [
  { icon: ShieldAlert, label: "Approvals", path: "/superadmin/dashboard" },
];

/* ─── single dock icon ─────────────────────────────────────── */
function DockIcon({
  icon: Icon,
  label,
  path,
  mouseX,
  isActive,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  path: string;
  mouseX: MotionValue<number>;
  isActive: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const sizeRaw = useTransform(distance, [-MAGNIFICATION_DIST, 0, MAGNIFICATION_DIST], [DEFAULT_SIZE, MAX_SIZE, DEFAULT_SIZE]);
  const size = useSpring(sizeRaw, { mass: 0.1, stiffness: 150, damping: 12 });

  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      ref={ref}
      style={{ width: size, height: size }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        relative flex items-center justify-center rounded-xl
        transition-colors duration-200        ${isActive
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
          : "bg-card/80 text-muted-foreground hover:bg-accent"
        }
      `}
    >
      <Icon style={{ width: "50%", height: "50%" }} strokeWidth={isActive ? 2.2 : 1.8} />

      {/* tooltip */}
      {hovered && (
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap
            bg-foreground text-background shadow-lg pointer-events-none"
        >
          {label}
        </motion.span>
      )}

      {/* active dot */}
      {isActive && (
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
      )}
    </motion.button>
  );
}

/* ─── dock bar ──────────────────────────────────────────────── */
export default function Dock({ userType }: { userType: "user" | "admin" | "superadmin" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const mouseX = useMotionValue(Infinity);

  const items =
    userType === "superadmin"
      ? superadminDockItems
      : userType === "admin"
      ? adminDockItems
      : userDockItems;

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className="dock-bar"
      style={{ height: DOCK_HEIGHT }}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 24, delay: 0.15 }}
    >      <div className="flex items-end gap-2 px-3 py-2.5 rounded-2xl
        bg-card/60
        backdrop-blur-xl backdrop-saturate-150
        border border-border/30
        shadow-xl shadow-black/[0.08]
      ">
        {items.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/dashboard" &&
              item.path !== "/admin/dashboard" &&
              location.pathname.startsWith(item.path));
          return (
            <DockIcon
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              mouseX={mouseX}
              isActive={isActive}
              onClick={() => navigate(item.path)}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
