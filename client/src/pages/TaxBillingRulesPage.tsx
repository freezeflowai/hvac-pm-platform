import { Link } from "wouter";
import { ArrowLeft, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TaxBillingRulesPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back-settings">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-tax-billing-title">Tax & Billing Rules</h1>
          <p className="text-sm text-muted-foreground">Configure tax rates and billing rules.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Tax & Billing Configuration
          </CardTitle>
          <CardDescription>
            Set up tax codes, rates, and billing rules for your invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm mt-1">Configure tax rates, exemptions, and billing rules for automated invoice calculations.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
