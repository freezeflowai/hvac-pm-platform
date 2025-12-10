import { Link } from "wouter";
import { ArrowLeft, FormInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CustomFieldsPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back-settings">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-custom-fields-title">Custom Fields</h1>
          <p className="text-sm text-muted-foreground">Define custom fields for clients, jobs, and invoices.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FormInput className="h-5 w-5" />
            Custom Fields
          </CardTitle>
          <CardDescription>
            Create custom data fields to capture additional information specific to your business.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <FormInput className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm mt-1">Custom fields will allow you to add extra data to clients, jobs, and invoices.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
