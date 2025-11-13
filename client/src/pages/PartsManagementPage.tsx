import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import PartsManagementDialog from "@/components/PartsManagementDialog";

export default function PartsManagementPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Manage Parts Inventory</h1>
          <p className="text-muted-foreground">Add and manage parts for maintenance schedules.</p>
        </div>
      </div>

      <PartsManagementDialog onCancel={() => setLocation("/")} />
    </div>
  );
}
