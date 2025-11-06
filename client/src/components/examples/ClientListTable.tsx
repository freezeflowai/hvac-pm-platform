import ClientListTable from '../ClientListTable';

export default function ClientListTableExample() {
  const clients = [
    {
      id: '1',
      companyName: 'ABC Manufacturing',
      location: '123 Industrial Blvd',
      scheduleType: 'monthly' as const,
      nextDue: new Date(2025, 10, 8),
    },
    {
      id: '2',
      companyName: 'XYZ Office Complex',
      location: '456 Business Park Dr',
      scheduleType: 'quarterly' as const,
      nextDue: new Date(2025, 10, 12),
    },
    {
      id: '3',
      companyName: 'Downtown Plaza',
      location: '789 Main Street',
      scheduleType: 'semi-annual' as const,
      nextDue: new Date(2025, 11, 15),
    },
  ];

  return (
    <div className="p-4">
      <ClientListTable clients={clients} />
    </div>
  );
}
