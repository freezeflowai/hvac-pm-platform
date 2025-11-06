import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface HeaderProps {
  onAddClient: () => void;
}

export default function Header({ onAddClient }: HeaderProps) {
  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">HVAC/R Scheduler</h1>
            <p className="text-sm text-muted-foreground">Preventive Maintenance Tracking</p>
          </div>
          <Button 
            onClick={onAddClient}
            data-testid="button-add-client"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>
    </header>
  );
}
