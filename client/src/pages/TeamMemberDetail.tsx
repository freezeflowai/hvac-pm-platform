import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, UserCircle, Clock, Shield, DollarSign, AlertTriangle } from "lucide-react";

interface TeamMemberWithDetails {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  role: string;
  roleId: string | null;
  status: string;
  useCustomSchedule: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  profile: {
    id: string;
    userId: string;
    laborCostPerHour: string | null;
    billableRatePerHour: string | null;
    color: string | null;
    phone: string | null;
    note: string | null;
  } | null;
  workingHours: Array<{
    id: string;
    userId: string;
    dayOfWeek: number;
    startTime: string | null;
    endTime: string | null;
    isWorking: boolean;
  }>;
  permissionOverrides: Array<{
    id: string;
    userId: string;
    permissionId: string;
    override: string;
  }>;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  hierarchy: number;
}

interface Permission {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const DEFAULT_HOURS = DAYS_OF_WEEK.map((day) => ({
  dayOfWeek: day.value,
  startTime: day.value >= 1 && day.value <= 5 ? "08:00" : null,
  endTime: day.value >= 1 && day.value <= 5 ? "17:00" : null,
  isWorking: day.value >= 1 && day.value <= 5,
}));

export default function TeamMemberDetail() {
  const { toast } = useToast();
  const [, params] = useRoute("/manage-team/:userId");
  const userId = params?.userId;

  const [basicInfo, setBasicInfo] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    roleId: "",
  });

  const [profile, setProfile] = useState({
    laborCostPerHour: "",
    billableRatePerHour: "",
    color: "#3b82f6",
    note: "",
  });

  const [workingHours, setWorkingHours] = useState(DEFAULT_HOURS);
  const [useCustomSchedule, setUseCustomSchedule] = useState(false);

  const { data: member, isLoading } = useQuery<TeamMemberWithDetails>({
    queryKey: ["/api/team", userId],
    enabled: !!userId,
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
  });

  const { data: effectivePermissions = [] } = useQuery<string[]>({
    queryKey: ["/api/team", userId, "effective-permissions"],
    enabled: !!userId,
  });

  useEffect(() => {
    if (member) {
      setBasicInfo({
        firstName: member.firstName || "",
        lastName: member.lastName || "",
        phone: member.phone || "",
        roleId: member.roleId || "",
      });
      setUseCustomSchedule(member.useCustomSchedule);

      if (member.profile) {
        setProfile({
          laborCostPerHour: member.profile.laborCostPerHour || "",
          billableRatePerHour: member.profile.billableRatePerHour || "",
          color: member.profile.color || "#3b82f6",
          note: member.profile.note || "",
        });
      }

      if (member.workingHours && member.workingHours.length > 0) {
        const hoursMap = new Map(member.workingHours.map(h => [h.dayOfWeek, h]));
        setWorkingHours(DAYS_OF_WEEK.map(day => {
          const existing = hoursMap.get(day.value);
          return {
            dayOfWeek: day.value,
            startTime: existing?.startTime || null,
            endTime: existing?.endTime || null,
            isWorking: existing?.isWorking ?? false,
          };
        }));
      }
    }
  }, [member]);

  const updateBasicMutation = useMutation({
    mutationFn: async (data: typeof basicInfo & { useCustomSchedule: boolean }) => {
      return await apiRequest("PATCH", `/api/team/${userId}`, {
        ...data,
        fullName: `${data.firstName} ${data.lastName}`.trim() || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Member updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profile) => {
      return await apiRequest("PUT", `/api/team/${userId}/profile`, data);
    },
    onSuccess: () => {
      toast({ title: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team", userId] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const updateWorkingHoursMutation = useMutation({
    mutationFn: async (hours: typeof workingHours) => {
      return await apiRequest("PUT", `/api/team/${userId}/working-hours`, { hours });
    },
    onSuccess: () => {
      toast({ title: "Working hours updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team", userId] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/team/${userId}/deactivate`, {});
    },
    onSuccess: () => {
      toast({ title: "Member deactivated" });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleWorkingHourChange = (dayOfWeek: number, field: string, value: any) => {
    setWorkingHours(prev => prev.map(h => 
      h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
    ));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <p>Loading team member...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <p>Team member not found</p>
          <Link href="/manage-team">
            <Button variant="outline" className="mt-4">Back to Team</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getInitials = () => {
    if (member.firstName && member.lastName) {
      return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
    }
    return member.email[0].toUpperCase();
  };

  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/manage-team">
            <Button variant="ghost" size="icon" data-testid="button-back-to-team">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4 flex-1">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl">{getInitials()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-member-name">
                {member.firstName && member.lastName
                  ? `${member.firstName} ${member.lastName}`
                  : member.fullName || member.email}
              </h1>
              <p className="text-muted-foreground">{member.email}</p>
            </div>
          </div>
          <Badge className={member.status === "active" ? "bg-green-600" : ""}>
            {member.status}
          </Badge>
        </div>

        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList>
            <TabsTrigger value="basic" data-testid="tab-basic-info">
              <UserCircle className="h-4 w-4 mr-2" />
              Basic Info
            </TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-schedule">
              <Clock className="h-4 w-4 mr-2" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">
              <DollarSign className="h-4 w-4 mr-2" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="permissions" data-testid="tab-permissions">
              <Shield className="h-4 w-4 mr-2" />
              Permissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Update team member's name, contact, and role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={basicInfo.firstName}
                      onChange={(e) => setBasicInfo(prev => ({ ...prev, firstName: e.target.value }))}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={basicInfo.lastName}
                      onChange={(e) => setBasicInfo(prev => ({ ...prev, lastName: e.target.value }))}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={basicInfo.phone}
                    onChange={(e) => setBasicInfo(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={basicInfo.roleId}
                    onValueChange={(value) => setBasicInfo(prev => ({ ...prev, roleId: value }))}
                  >
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>{role.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="font-medium">Use Custom Schedule</p>
                    <p className="text-sm text-muted-foreground">Override default company working hours</p>
                  </div>
                  <Switch
                    checked={useCustomSchedule}
                    onCheckedChange={setUseCustomSchedule}
                    data-testid="switch-custom-schedule"
                  />
                </div>
                <div className="flex justify-between pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => deactivateMutation.mutate()}
                    disabled={deactivateMutation.isPending}
                    data-testid="button-deactivate"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Deactivate Member
                  </Button>
                  <Button
                    onClick={() => updateBasicMutation.mutate({ ...basicInfo, useCustomSchedule })}
                    disabled={updateBasicMutation.isPending}
                    data-testid="button-save-basic"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Working Hours</CardTitle>
                <CardDescription>Set the team member's regular working schedule</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!useCustomSchedule && (
                  <div className="p-4 bg-muted rounded-lg mb-4">
                    <p className="text-sm text-muted-foreground">
                      This member is using the default company schedule. Enable "Use Custom Schedule" in Basic Info to customize their hours.
                    </p>
                  </div>
                )}
                {DAYS_OF_WEEK.map((day) => {
                  const hours = workingHours.find(h => h.dayOfWeek === day.value) || {
                    dayOfWeek: day.value,
                    startTime: null,
                    endTime: null,
                    isWorking: false,
                  };
                  return (
                    <div key={day.value} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <div className="w-28">
                        <span className="font-medium">{day.label}</span>
                      </div>
                      <Switch
                        checked={hours.isWorking}
                        onCheckedChange={(checked) => handleWorkingHourChange(day.value, "isWorking", checked)}
                        disabled={!useCustomSchedule}
                        data-testid={`switch-working-${day.value}`}
                      />
                      {hours.isWorking && (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="time"
                            value={hours.startTime || ""}
                            onChange={(e) => handleWorkingHourChange(day.value, "startTime", e.target.value)}
                            className="w-32"
                            disabled={!useCustomSchedule}
                            data-testid={`input-start-${day.value}`}
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={hours.endTime || ""}
                            onChange={(e) => handleWorkingHourChange(day.value, "endTime", e.target.value)}
                            className="w-32"
                            disabled={!useCustomSchedule}
                            data-testid={`input-end-${day.value}`}
                          />
                        </div>
                      )}
                      {!hours.isWorking && (
                        <span className="text-muted-foreground">Off</span>
                      )}
                    </div>
                  );
                })}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => updateWorkingHoursMutation.mutate(workingHours)}
                    disabled={updateWorkingHoursMutation.isPending || !useCustomSchedule}
                    data-testid="button-save-schedule"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Billing & Costs</CardTitle>
                <CardDescription>Configure labor costs and billing rates for this team member</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="laborCost">Labor Cost (per hour)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="laborCost"
                        type="number"
                        step="0.01"
                        value={profile.laborCostPerHour}
                        onChange={(e) => setProfile(prev => ({ ...prev, laborCostPerHour: e.target.value }))}
                        className="pl-7"
                        placeholder="0.00"
                        data-testid="input-labor-cost"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Internal cost of this technician's time</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billableRate">Billable Rate (per hour)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="billableRate"
                        type="number"
                        step="0.01"
                        value={profile.billableRatePerHour}
                        onChange={(e) => setProfile(prev => ({ ...prev, billableRatePerHour: e.target.value }))}
                        className="pl-7"
                        placeholder="0.00"
                        data-testid="input-billable-rate"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Rate charged to customers</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Calendar Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={profile.color}
                      onChange={(e) => setProfile(prev => ({ ...prev, color: e.target.value }))}
                      className="w-16 h-9 p-1"
                      data-testid="input-color"
                    />
                    <span className="text-sm text-muted-foreground">Used to identify this technician on the calendar</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Notes</Label>
                  <Input
                    id="note"
                    value={profile.note}
                    onChange={(e) => setProfile(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Internal notes about this team member"
                    data-testid="input-note"
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => updateProfileMutation.mutate(profile)}
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-billing"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Billing Info
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle>Permissions</CardTitle>
                <CardDescription>
                  View and customize this member's access rights. Permissions are inherited from their role with optional overrides.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(permissionsByCategory).map(([category, categoryPerms]) => (
                    <div key={category}>
                      <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground mb-3">
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {categoryPerms.map((perm) => {
                          const hasPermission = effectivePermissions.includes(perm.name);
                          const override = member.permissionOverrides.find(o => o.permissionId === perm.id);
                          return (
                            <div
                              key={perm.id}
                              className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                            >
                              <div>
                                <p className="font-medium text-sm">{perm.displayName}</p>
                                {perm.description && (
                                  <p className="text-xs text-muted-foreground">{perm.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {override && (
                                  <Badge variant="outline" className="text-xs">
                                    {override.override === "grant" ? "Granted" : "Revoked"}
                                  </Badge>
                                )}
                                <Badge variant={hasPermission ? "default" : "secondary"}>
                                  {hasPermission ? "Yes" : "No"}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Permission overrides can be configured by admins. Contact your administrator to modify individual permissions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
