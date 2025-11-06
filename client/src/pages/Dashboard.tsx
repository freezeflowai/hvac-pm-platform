import { useState } from "react";
import Header from "@/components/Header";
import StatsCard from "@/components/StatsCard";
import MaintenanceSection from "@/components/MaintenanceSection";
import ClientListTable from "@/components/ClientListTable";
import AddClientDialog, { ClientFormData } from "@/components/AddClientDialog";
import { AlertCircle, Calendar, CheckCircle, Clock } from "lucide-react";
import { MaintenanceItem } from "@/components/MaintenanceCard";
import { Client } from "@/components/ClientListTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // TODO: remove mock functionality - replace with real data from backend
  const [clients, setClients] = useState<Client[]>([
    {
      id: '1',
      companyName: 'ABC Manufacturing',
      location: '123 Industrial Blvd',
      scheduleType: 'monthly',
      nextDue: new Date(2025, 10, 8),
    },
    {
      id: '2',
      companyName: 'XYZ Office Complex',
      location: '456 Business Park Dr',
      scheduleType: 'quarterly',
      nextDue: new Date(2025, 10, 12),
    },
    {
      id: '3',
      companyName: 'Downtown Plaza',
      location: '789 Main Street',
      scheduleType: 'semi-annual',
      nextDue: new Date(2025, 11, 15),
    },
    {
      id: '4',
      companyName: 'Riverside Restaurant',
      location: '321 Water St',
      scheduleType: 'monthly',
      nextDue: new Date(2025, 10, 20),
    },
    {
      id: '5',
      companyName: 'Tech Solutions Inc',
      location: '555 Innovation Way',
      scheduleType: 'quarterly',
      nextDue: new Date(2025, 11, 1),
    },
  ]);

  // TODO: remove mock functionality - replace with real data from backend
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([
    {
      id: '1',
      companyName: 'ABC Manufacturing',
      location: '123 Industrial Blvd',
      scheduleType: 'monthly',
      nextDue: new Date(2025, 10, 8),
      status: 'overdue',
    },
    {
      id: '2',
      companyName: 'XYZ Office Complex',
      location: '456 Business Park Dr',
      scheduleType: 'quarterly',
      nextDue: new Date(2025, 10, 12),
      status: 'upcoming',
    },
    {
      id: '4',
      companyName: 'Riverside Restaurant',
      location: '321 Water St',
      scheduleType: 'monthly',
      nextDue: new Date(2025, 10, 20),
      status: 'upcoming',
    },
  ]);

  const overdueItems = maintenanceItems.filter(item => item.status === 'overdue');
  const thisWeekItems = maintenanceItems.filter(item => {
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return item.nextDue <= weekFromNow && item.status !== 'overdue';
  });
  const thisMonthItems = maintenanceItems.filter(item => {
    const monthFromNow = new Date();
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
    return item.nextDue <= monthFromNow && item.status !== 'overdue';
  });

  // TODO: remove mock functionality - calculate from real completed maintenance records
  const completedCount = 156;

  const handleAddClient = (data: ClientFormData) => {
    // TODO: remove mock functionality - send to backend API
    const newClient: Client = {
      id: Date.now().toString(),
      companyName: data.companyName,
      location: data.location,
      scheduleType: data.scheduleType,
      nextDue: new Date(),
    };
    setClients([...clients, newClient]);
    console.log('New client added:', data);
  };

  const handleMarkComplete = (id: string) => {
    // TODO: remove mock functionality - send to backend API
    setMaintenanceItems(maintenanceItems.filter(item => item.id !== id));
    console.log('Marked complete:', id);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onAddClient={() => setShowAddDialog(true)} />
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Overdue" value={overdueItems.length} icon={AlertCircle} variant="danger" />
          <StatsCard title="This Week" value={thisWeekItems.length} icon={Clock} variant="warning" />
          <StatsCard title="This Month" value={thisMonthItems.length} icon={Calendar} variant="default" />
          <StatsCard title="Completed" value={completedCount} icon={CheckCircle} variant="default" />
        </div>

        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList data-testid="tabs-main-nav">
            <TabsTrigger value="schedule" data-testid="tab-schedule">
              Schedule
            </TabsTrigger>
            <TabsTrigger value="clients" data-testid="tab-clients">
              All Clients
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-6">
            {overdueItems.length > 0 && (
              <MaintenanceSection
                title="Overdue Maintenance"
                items={overdueItems}
                onMarkComplete={handleMarkComplete}
                emptyMessage="No overdue maintenance"
              />
            )}

            <MaintenanceSection
              title="Due This Week"
              items={thisWeekItems}
              onMarkComplete={handleMarkComplete}
              emptyMessage="No maintenance due this week"
            />

            <MaintenanceSection
              title="Due This Month"
              items={thisMonthItems}
              onMarkComplete={handleMarkComplete}
              emptyMessage="No maintenance due this month"
            />
          </TabsContent>

          <TabsContent value="clients">
            <ClientListTable clients={clients} />
          </TabsContent>
        </Tabs>
      </main>

      <AddClientDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSubmit={handleAddClient}
      />
    </div>
  );
}
