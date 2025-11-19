import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ShieldCheck, ShieldOff, Package, KeyRound, MessageCircle } from "lucide-react";
import NewAddClientDialog from "@/components/NewAddClientDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { Feedback } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
}

export default function Admin() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [, setLocation] = useLocation();
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);

  const { data: allClients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: feedback = [] } = useQuery<Feedback[]>({
    queryKey: ["/api/feedback"],
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User deleted",
        description: "The user has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/admin`, { isAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Admin status updated",
        description: "The user's admin status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update admin status",
        variant: "destructive",
      });
    },
  });

  const seedPartsMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/seed-parts`);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Parts seeded successfully",
        description: `${data.count} standard parts have been added to the user's inventory.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to seed parts",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/reset-password`, { password });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset successfully",
        description: "The user's password has been updated.",
      });
      setResetPasswordUserId(null);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const updateFeedbackStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/feedback/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({
        title: "Status updated",
        description: "Feedback status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update feedback status",
        variant: "destructive",
      });
    },
  });

  const handleResetPassword = () => {
    if (!resetPasswordUserId) return;
    
    if (newPassword.length < 6) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords match",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({ userId: resetPasswordUserId, password: newPassword });
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!currentUser?.isAdmin) {
    return (
      <>
        <div className="flex items-center justify-center h-screen">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                You don't have permission to access this page. Admin privileges are required.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="p-6 mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="users" data-testid="tab-users">User Management</TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">
            Feedback
            {feedback.filter(f => f.status === "new").length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5">
                {feedback.filter(f => f.status === "new").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
            </CardHeader>
            <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`user-item-${user.id}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" data-testid={`text-email-${user.id}`}>
                      {user.email}
                    </span>
                    {user.isAdmin && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                        Admin
                      </span>
                    )}
                    {user.id === currentUser.id && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid={`text-id-${user.id}`}>
                    ID: {user.id}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={seedPartsMutation.isPending}
                    onClick={() => seedPartsMutation.mutate(user.id)}
                    data-testid={`button-seed-parts-${user.id}`}
                    title="Seed standard parts inventory"
                  >
                    <Package className="h-4 w-4" />
                  </Button>

                  <Dialog open={resetPasswordUserId === user.id} onOpenChange={(open) => {
                    if (!open) {
                      setResetPasswordUserId(null);
                      setNewPassword("");
                      setConfirmPassword("");
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setResetPasswordUserId(user.id)}
                        data-testid={`button-reset-password-${user.id}`}
                        aria-label="Reset password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                          Set a new password for {user.email}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <Input
                            id="new-password"
                            type="password"
                            placeholder="Enter new password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            data-testid="input-new-password"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm Password</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            data-testid="input-confirm-password"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setResetPasswordUserId(null);
                            setNewPassword("");
                            setConfirmPassword("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleResetPassword}
                          disabled={resetPasswordMutation.isPending}
                          data-testid="button-confirm-reset-password"
                        >
                          {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={toggleAdminMutation.isPending}
                        data-testid={`button-toggle-admin-${user.id}`}
                        aria-label={user.isAdmin ? "Remove admin status" : "Grant admin status"}
                      >
                        {user.isAdmin ? (
                          <ShieldOff className="h-4 w-4" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {user.isAdmin ? "Remove Admin Status" : "Grant Admin Status"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {user.isAdmin
                            ? "Are you sure you want to remove admin privileges from this user?"
                            : "Are you sure you want to grant admin privileges to this user?"}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            toggleAdminMutation.mutate({
                              userId: user.id,
                              isAdmin: !user.isAdmin,
                            })
                          }
                        >
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        disabled={deleteUserMutation.isPending || user.id === currentUser.id}
                        data-testid={`button-delete-user-${user.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this user? This action cannot be undone.
                          All of their clients, parts, and maintenance records will be permanently deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteUserMutation.mutate(user.id)}
                          className="bg-destructive text-destructive-foreground"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle>User Feedback</CardTitle>
              <CardDescription>
                Recommendations, questions, and issues reported by users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {feedback.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No feedback submissions yet
                  </p>
                ) : (
                  feedback.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border rounded-lg space-y-2"
                      data-testid={`feedback-item-${item.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={
                              item.category === "bug" ? "destructive" :
                              item.category === "feature" ? "default" :
                              "secondary"
                            }>
                              {item.category}
                            </Badge>
                            <Badge variant={
                              item.status === "new" ? "destructive" :
                              item.status === "in-progress" ? "default" :
                              "secondary"
                            }>
                              {item.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            From: {item.userEmail}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                        </div>
                        <div className="flex gap-1 ml-4">
                          {item.status === "new" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateFeedbackStatusMutation.mutate({ id: item.id, status: "in-progress" })}
                              disabled={updateFeedbackStatusMutation.isPending}
                              data-testid={`button-feedback-in-progress-${item.id}`}
                            >
                              In Progress
                            </Button>
                          )}
                          {item.status !== "resolved" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateFeedbackStatusMutation.mutate({ id: item.id, status: "resolved" })}
                              disabled={updateFeedbackStatusMutation.isPending}
                              data-testid={`button-feedback-resolve-${item.id}`}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
