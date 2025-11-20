import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { differenceInDays, format } from "date-fns";

interface Usage {
  plan: {
    name: string;
    displayName: string;
  } | null;
  trialEndsAt: string | null;
}

export function SubscriptionBanner() {
  const [dismissed, setDismissed] = useState(false);

  const { data: usage } = useQuery<Usage>({
    queryKey: ["/api/subscriptions/usage"]
  });

  if (!usage || !usage.plan || dismissed) {
    return null;
  }

  const { plan, trialEndsAt } = usage;

  // Only show banner for trial users
  if (plan.name !== 'trial' || !trialEndsAt) {
    return null;
  }

  const trialEndDate = new Date(trialEndsAt);
  const now = new Date();
  const daysRemaining = differenceInDays(trialEndDate, now);
  const isExpired = daysRemaining < 0;
  const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 7;

  // Only show if expired or expiring soon
  if (!isExpired && !isExpiringSoon) {
    return null;
  }

  return (
    <Alert 
      variant={isExpired ? "destructive" : "default"}
      className="rounded-none border-x-0 border-t-0"
      data-testid="banner-trial-expiration"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>
          {isExpired ? (
            <>Your trial expired on {format(trialEndDate, "MMM d, yyyy")}. Upgrade to continue adding locations.</>
          ) : (
            <>Your trial ends in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} ({format(trialEndDate, "MMM d, yyyy")}). Upgrade to continue service.</>
          )}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setDismissed(true)}
          data-testid="button-dismiss-banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
