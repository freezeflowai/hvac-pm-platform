import ClientListTable from '../ClientListTable';

export default function ClientListTableExample() {
  const clients = [
    {
      id: '1',
      companyName: 'ABC Manufacturing',
      location: '123 Industrial Blvd',
      selectedMonths: [0, 2, 4, 6, 8, 10],
      nextDue: new Date(2025, 10, 8),
    },
    {
      id: '2',
      companyName: 'XYZ Office Complex',
      location: '456 Business Park Dr',
      selectedMonths: [2, 5, 8, 11],
      nextDue: new Date(2025, 10, 12),
    },
    {
      id: '3',
      companyName: 'Downtown Plaza',
      location: '789 Main Street',
      selectedMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      nextDue: new Date(2025, 11, 15),
    },
  ];

  return (
    <div className="p-4">
      <ClientListTable clients={clients} onEdit={(id) => console.log('Edit client:', id)} />
    </div>
  );
}
