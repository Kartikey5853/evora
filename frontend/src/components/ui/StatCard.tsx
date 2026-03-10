import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    positive: boolean;
  };
}

const StatCard = ({ icon: Icon, label, value, trend }: StatCardProps) => {
  return (
    <div className="card-stat group hover:shadow-medium transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center group-hover:bg-primary/10 transition-colors">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend.positive ? 'bg-accent text-primary' : 'bg-red-100 text-red-700'}`}>
            {trend.positive ? '+' : ''}{trend.value}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-sm mb-1">{label}</p>
      <p className="font-display font-bold text-2xl text-foreground">{value}</p>
    </div>
  );
};

export default StatCard;
