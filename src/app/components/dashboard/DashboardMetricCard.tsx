import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface DashboardMetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  accentClassName: string;
}

export function DashboardMetricCard({
  title,
  value,
  description,
  icon: Icon,
  accentClassName,
}: DashboardMetricCardProps) {
  return (
    <Card className={`card ${accentClassName}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-gray-300">{title}</CardTitle>
        <Icon className="h-5 w-5 text-orange-300" />
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold text-white">{value}</div>
        <p className="text-xs text-gray-400">{description}</p>
      </CardContent>
    </Card>
  );
}
