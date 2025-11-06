import MaintenanceCard from '../MaintenanceCard';

export default function MaintenanceCardExample() {
  const items = [
    {
      id: '1',
      companyName: 'ABC Manufacturing',
      location: '123 Industrial Blvd',
      selectedMonths: [0, 2, 4, 6, 8, 10],
      nextDue: new Date(2025, 10, 8),
      status: 'overdue' as const,
    },
    {
      id: '2',
      companyName: 'XYZ Office Complex',
      location: '456 Business Park Dr',
      selectedMonths: [2, 5, 8, 11],
      nextDue: new Date(2025, 10, 12),
      status: 'upcoming' as const,
    },
  ];

  return (
    <div className="p-4 space-y-4">
      {items.map(item => (
        <MaintenanceCard
          key={item.id}
          item={item}
          onMarkComplete={(id) => console.log('Mark complete:', id)}
          onEdit={(id) => console.log('Edit:', id)}
        />
      ))}
    </div>
  );
}
