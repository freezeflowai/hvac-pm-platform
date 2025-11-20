import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  locationLimit: number;
  active: boolean;
}

interface Usage {
  plan: Plan | null;
  usage: {
    locations: number;
  };
  percentUsed: number;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
}

export function SubscriptionOverview() {
  const { data: usage, isLoading } = useQuery<Usage>({
    queryKey: ["/api/subscriptions/usage"]
  });

  if (isLoading) {
    return (
      <Card data-testid="card-subscription-loading">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Loading subscription information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!usage || !usage.plan) {
    return null;
  }

  const { plan, usage: currentUsage, percentUsed, trialEndsAt, subscriptionStatus } = usage;
  const isTrialExpiring = trialEndsAt && new Date(trialEndsAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const isTrialExpired = trialEndsAt && new Date(trialEndsAt) < new Date();

  return (
    <Card data-testid="card-subscription-overview">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              Subscription
              {plan.name === 'trial' && (
                <Badge variant="outline" data-testid="badge-trial">
                  <Clock className="h-3 w-3 mr-1" />
                  Trial
                </Badge>
              )}
              {plan.name !== 'trial' && (
                <Badge data-testid={`badge-plan-${plan.name}`}>
                  {plan.displayName}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {plan.locationLimit === 9999999 
                ? "Unlimited locations" 
                : `${currentUsage.locations} of ${plan.locationLimit} locations used`}
            </CardDescription>
          </div>
          {plan.name !== 'trial' && plan.price > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold">${plan.price}</div>
              <div className="text-xs text-muted-foreground">per month</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.locationLimit !== 9999999 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Location Usage</span>
              <span className="font-medium" data-testid="text-usage-percentage">
                {percentUsed.toFixed(0)}%
              </span>
            </div>
            <Progress 
              value={percentUsed} 
              className="h-2"
              data-testid="progress-location-usage"
            />
          </div>
        )}

        {plan.name === 'trial' && trialEndsAt && (
          <Alert 
            variant={isTrialExpired ? "destructive" : isTrialExpiring ? "default" : "default"}
            data-testid={isTrialExpired ? "alert-trial-expired" : "alert-trial-active"}
          >
            {isTrialExpired ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <AlertTitle>
              {isTrialExpired ? "Trial Expired" : "Trial Active"}
            </AlertTitle>
            <AlertDescription>
              {isTrialExpired ? (
                <>Your trial ended on {format(new Date(trialEndsAt), "MMM d, yyyy")}. Upgrade to continue adding locations.</>
              ) : (
                <>Your trial ends on {format(new Date(trialEndsAt), "MMM d, yyyy")}.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {percentUsed >= 90 && percentUsed < 100 && (
          <Alert data-testid="alert-usage-warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Approaching Limit</AlertTitle>
            <AlertDescription>
              You're using {currentUsage.locations} of {plan.locationLimit} locations. 
              Consider upgrading your plan to add more clients.
            </AlertDescription>
          </Alert>
        )}

        {percentUsed >= 100 && (
          <Alert variant="destructive" data-testid="alert-limit-reached">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Location Limit Reached</AlertTitle>
            <AlertDescription>
              You've reached your location limit. Upgrade your plan to add more clients.
            </AlertDescription>
          </Alert>
        )}

        {subscriptionStatus === 'active' && plan.name !== 'trial' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Active subscription</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
