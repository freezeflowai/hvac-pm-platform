import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, UserCircle, Users, Shield, Clock, ChevronRight, ArrowUpDown, Mail } from "lucide-react";

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  role: string;
  roleId: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  hierarchy: number;
}

type SortOption = "name-asc" | "name-desc" | "login-newest" | "login-oldest" | "role";

export default function ManageTeam() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    roleId: "",
    notes: "",
  });

  const { data: teamMembers = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team"],
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const filteredMembers = teamMembers
    .filter((member) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (member.firstName?.toLowerCase() || "").includes(searchLower) ||
        (member.lastName?.toLowerCase() || "").includes(searchLower) ||
        (member.email?.toLowerCase() || "").includes(searchLower) ||
        (member.fullName?.toLowerCase() || "").includes(searchLower) ||
        (member.role?.toLowerCase() || "").includes(searchLower) ||
        (member.phone?.toLowerCase() || "").includes(searchLower);
      
      const matchesStatus = statusFilter === "all" || member.status === statusFilter;
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      
      return matchesSearch && matchesStatus && matchesRole;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return getDisplayName(a).localeCompare(getDisplayName(b));
        case "name-desc":
          return getDisplayName(b).localeCompare(getDisplayName(a));
        case "login-newest":
          if (!a.lastLoginAt && !b.lastLoginAt) return 0;
          if (!a.lastLoginAt) return 1;
          if (!b.lastLoginAt) return -1;
          return new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime();
        case "login-oldest":
          if (!a.lastLoginAt && !b.lastLoginAt) return 0;
          if (!a.lastLoginAt) return 1;
          if (!b.lastLoginAt) return -1;
          return new Date(a.lastLoginAt).getTime() - new Date(b.lastLoginAt).getTime();
        case "role":
          return a.role.localeCompare(b.role);
        default:
          return 0;
      }
    });

  function getDisplayName(member: TeamMember) {
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    return member.fullName || member.email;
  }

  const getInitials = (member: TeamMember) => {
    if (member.firstName && member.lastName) {
      return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
    }
    return member.email[0].toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case "deactivated":
        return <Badge variant="secondary">Disabled</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      owner: "bg-purple-600",
      admin: "bg-blue-600",
      manager: "bg-cyan-600",
      dispatcher: "bg-amber-600",
      technician: "bg-gray-600",
    };
    const colorClass = roleColors[role.toLowerCase()] || "bg-gray-600";
    return <Badge className={colorClass}>{role}</Badge>;
  };

  const handleInviteSubmit = () => {
    toast({
      title: "Invite sent",
      description: `An invitation has been sent to ${inviteForm.email}`,
    });
    setInviteDialogOpen(false);
    setInviteForm({ fullName: "", email: "", roleId: "", notes: "" });
  };

  const activeCount = teamMembers.filter(m => m.status === "active").length;
  const totalCount = teamMembers.length;
  const pendingCount = teamMembers.filter(m => m.status === "pending").length;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-team-management-title">Team Management</h1>
            <p className="text-muted-foreground mt-1">Manage your team members, roles, and permissions</p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="default" data-testid="button-invite-member">
                <Plus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to add a new member to your team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Full Name</Label>
                  <Input
                    id="invite-name"
                    value={inviteForm.fullName}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="John Doe"
                    data-testid="input-invite-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@example.com"
                    data-testid="input-invite-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteForm.roleId}
                    onValueChange={(value) => setInviteForm(prev => ({ ...prev, roleId: value }))}
                  >
                    <SelectTrigger data-testid="select-invite-role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>{role.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-notes">Notes (optional)</Label>
                  <Textarea
                    id="invite-notes"
                    value={inviteForm.notes}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional notes for this team member..."
                    data-testid="input-invite-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleInviteSubmit}
                  disabled={!inviteForm.email || !inviteForm.fullName}
                  data-testid="button-send-invite"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-members">{totalCount}</p>
                  <p className="text-xs text-muted-foreground">Total Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <UserCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-active-members">{activeCount}</p>
                  <p className="text-xs text-muted-foreground">Active Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-roles-count">{roles.length}</p>
                  <p className="text-xs text-muted-foreground">Roles Defined</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-pending-count">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending Invites</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, role, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-team"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="deactivated">Disabled</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-role-filter">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>{role.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[150px]" data-testid="select-sort">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                    <SelectItem value="name-desc">Name Z-A</SelectItem>
                    <SelectItem value="login-newest">Last Login (Newest)</SelectItem>
                    <SelectItem value="login-oldest">Last Login (Oldest)</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading team members...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || statusFilter !== "all" || roleFilter !== "all"
                  ? "No team members match your filters"
                  : "No team members found"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id} data-testid={`row-team-member-${member.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{getInitials(member)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium" data-testid={`text-member-name-${member.id}`}>
                              {getDisplayName(member)}
                            </p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(member.role)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(member.status)}
                      </TableCell>
                      <TableCell>
                        {member.lastLoginAt ? (
                          <span className="text-sm text-muted-foreground">
                            {new Date(member.lastLoginAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/manage-team/${member.id}`}>
                          <Button variant="ghost" size="icon" data-testid={`button-view-member-${member.id}`}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
