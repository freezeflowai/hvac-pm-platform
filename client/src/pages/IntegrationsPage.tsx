import { Link } from "wouter";
import { ArrowLeft, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function IntegrationsPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back-settings">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-integrations-title">Integrations</h1>
          <p className="text-sm text-muted-foreground">Connect with third-party services.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Third-Party Integrations
          </CardTitle>
          <CardDescription>
            Connect your account with QuickBooks, payment processors, and other services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Plug className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm mt-1">QuickBooks Online sync, payment processing, and more integrations are on the way.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
