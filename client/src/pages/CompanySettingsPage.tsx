import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCompanySettingsSchema, type CompanySettings } from "@shared/schema";
import type { z } from "zod";
import NewAddClientDialog from "@/components/NewAddClientDialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type CompanySettingsFormData = z.infer<typeof insertCompanySettingsSchema>;

export default function CompanySettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);

  const { data: settings, isLoading } = useQuery<CompanySettings | null>({
    queryKey: ["/api/company-settings"],
    enabled: Boolean(user?.id),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const form = useForm<CompanySettingsFormData>({
    resolver: zodResolver(insertCompanySettingsSchema),
    defaultValues: {
      companyName: "",
      address: "",
      city: "",
      provinceState: "",
      postalCode: "",
      email: "",
      phone: "",
    },
  });

  useEffect(() => {
    if (settings !== undefined) {
      form.reset({
        companyName: settings?.companyName || "",
        address: settings?.address || "",
        city: settings?.city || "",
        provinceState: settings?.provinceState || "",
        postalCode: settings?.postalCode || "",
        email: settings?.email || "",
        phone: settings?.phone || "",
      });
    }
  }, [settings, form]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: CompanySettingsFormData) => {
      const res = await apiRequest("POST", "/api/company-settings", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      toast({
        title: "Settings saved",
        description: "Your company settings have been updated successfully.",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save company settings.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanySettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const handleCancel = () => {
    setLocation("/");
  };

  const { data: allClients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="p-6 mx-auto">
        <Button 
          variant="ghost" 
          onClick={handleCancel}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Company Settings</CardTitle>
            <CardDescription>
              Update your company information. The company name will appear in the app header.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ""}
                          placeholder="Enter your company name"
                          data-testid="input-company-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          value={field.value || ""}
                          placeholder="123 Main Street"
                          data-testid="input-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ""}
                            placeholder="City"
                            data-testid="input-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="provinceState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province/State</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ""}
                            placeholder="ON"
                            data-testid="input-province-state"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal/Zip Code</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ""}
                            placeholder="A1A 1A1"
                            data-testid="input-postal-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ""}
                            type="email"
                            placeholder="company@example.com"
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ""}
                            type="tel"
                            placeholder="(555) 123-4567"
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateSettingsMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    data-testid="button-save"
                  >
                    {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <NewAddClientDialog 
        open={addClientDialogOpen}
        onOpenChange={setAddClientDialogOpen}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        }}
      />
    </>
  );
}
