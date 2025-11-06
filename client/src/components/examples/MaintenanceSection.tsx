import MaintenanceSection from '../MaintenanceSection';

export default function MaintenanceSectionExample() {
  const items = [
    {
      id: '1',
      companyName: 'ABC Manufacturing',
      location: '123 Industrial Blvd',
      selectedMonths: [0, 2, 4, 6, 8, 10],
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
        onEdit={(id) => console.log('Edit:', id)}
        emptyMessage="No overdue items"
      />
    </div>
  );
}
