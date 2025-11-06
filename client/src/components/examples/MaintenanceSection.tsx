import MaintenanceSection from '../MaintenanceSection';

export default function MaintenanceSectionExample() {
  const items = [
    {
      id: '1',
      companyName: 'ABC Manufacturing',
      location: '123 Industrial Blvd',
      scheduleType: 'monthly' as const,
      nextDue: new Date(2025, 10, 8),
      status: 'overdue' as const,
    },
  ];

  return (
    <div className="p-4">
      <MaintenanceSection
        title="Overdue Maintenance"
        items={items}
        onMarkComplete={(id) => console.log('Mark complete:', id)}
        emptyMessage="No overdue items"
      />
    </div>
  );
}
