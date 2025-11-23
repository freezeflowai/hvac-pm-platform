import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface PartItem {
  description: string;
  quantity: number;
}

interface PartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  parts: PartItem[];
}

export function PartsDialog({ open, onOpenChange, title, parts }: PartsDialogProps) {
  // Group parts by description and sum quantities
  const groupedParts = parts.reduce((acc, part) => {
    const existing = acc.find(p => p.description === part.description);
    if (existing) {
      existing.quantity += part.quantity;
    } else {
      acc.push({ ...part });
    }
    return acc;
  }, [] as PartItem[]);

  const totalParts = groupedParts.reduce((sum, part) => sum + part.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          data-testid="button-close-parts-dialog"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <DialogHeader>
          <DialogTitle className="text-base font-semibold pr-6">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="text-sm text-muted-foreground">
            Total: {totalParts} part{totalParts !== 1 ? 's' : ''}
          </div>

          <div className="space-y-2 bg-muted/30 rounded-md p-3 max-h-96 overflow-y-auto">
            {groupedParts.length > 0 ? (
              groupedParts.map((part, index) => (
                <div 
                  key={index} 
                  className="flex justify-between text-sm py-1"
                  data-testid={`part-row-${index}`}
                >
                  <span className="flex-1">{part.description}</span>
                  <span className="font-medium ml-4">{part.quantity}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No parts scheduled</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
