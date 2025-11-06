import StatsCard from '../StatsCard';
import { AlertCircle, Calendar, CheckCircle, Clock } from 'lucide-react';

export default function StatsCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
      <StatsCard title="Overdue" value={3} icon={AlertCircle} variant="danger" />
      <StatsCard title="This Week" value={8} icon={Clock} variant="warning" />
      <StatsCard title="This Month" value={24} icon={Calendar} variant="default" />
      <StatsCard title="Completed" value={156} icon={CheckCircle} variant="default" />
    </div>
  );
}
