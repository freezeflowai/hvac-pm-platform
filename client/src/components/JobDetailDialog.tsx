import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2, Plus, Camera, Edit2, X, AlertTriangle, Save, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CalendarAssignment {
  id: string;
  clientId: string;
  year: number;
  month: number;
  day: number | null;
  scheduledDate: string;
  scheduledHour: number | null;
  completed: boolean;
  completionNotes: string | null;
  assignedTechnicianIds: string[] | null;
}

interface Client {
  id: string;
  companyName: string;
  location: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}

interface JobNote {
  id: string;
  assignmentId: string;
  noteText: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface JobDetailDialogProps {
  assignment: CalendarAssignment | null;
  client: Client | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getJobStatus(assignment: CalendarAssignment): { label: string; variant: "default" | "destructive" | "secondary" | "outline" } {
  if (assignment.completed) {
    return { label: "COMPLETED", variant: "secondary" };
  }
  
  if (assignment.day === null) {
    return { label: "Unscheduled", variant: "outline" };
  }
  
  const scheduledDate = parseLocalDate(assignment.scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (scheduledDate < today) {
    return { label: "Late", variant: "destructive" };
  }
  
  return { label: "Upcoming", variant: "default" };
}

function formatAddress(client: Client | undefined): string {
  if (!client) return "No address";
  const parts = [
    client.address,
    client.city,
    client.province,
    client.postalCode
  ].filter(Boolean);
  return parts.join(", ") || "No address";
}

export function JobDetailDialog({ assignment, client, open, onOpenChange }: JobDetailDialogProps) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteImage, setNewNoteImage] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editingNoteImage, setEditingNoteImage] = useState<string | null>(null);

  const { data: notes = [], isLoading: isLoadingNotes } = useQuery<JobNote[]>({
    queryKey: ["/api/job-notes", assignment?.id],
    queryFn: async () => {
      if (!assignment) return [];
      const res = await fetch(`/api/job-notes/${assignment.id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
    enabled: !!assignment && open,
  });

  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/calendar/assign/${assignment!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/overdue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/statuses"] });
      toast({ title: "Job deleted successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to delete job", variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: { noteText: string; imageUrl: string | null }) => {
      await apiRequest("POST", "/api/job-notes", {
        assignmentId: assignment!.id,
        noteText: data.noteText,
        imageUrl: data.imageUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-notes", assignment?.id] });
      setNewNoteText("");
      setNewNoteImage(null);
      toast({ title: "Note added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, noteText, imageUrl }: { id: string; noteText: string; imageUrl?: string | null }) => {
      const body: { noteText: string; imageUrl?: string | null } = { noteText };
      if (imageUrl !== undefined) {
        body.imageUrl = imageUrl;
      }
      await apiRequest("PATCH", `/api/job-notes/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-notes", assignment?.id] });
      setEditingNoteId(null);
      setEditingNoteText("");
      setEditingNoteImage(null);
      toast({ title: "Note updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update note", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/job-notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-notes", assignment?.id] });
      toast({ title: "Note deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    },
  });

  const uploadImage = async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const res = await fetch('/api/job-notes/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              imageData: reader.result,
              assignmentId: assignment!.id,
            }),
          });
          if (res.ok) {
            const { imageUrl } = await res.json();
            resolve(imageUrl);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewNoteImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingNoteImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim() && !newNoteImage) return;
    
    setIsSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (newNoteImage) {
        const file = fileInputRef.current?.files?.[0];
        if (file) {
          imageUrl = await uploadImage(file);
        }
      }
      await createNoteMutation.mutateAsync({ noteText: newNoteText.trim() || "Image note", imageUrl });
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editingNoteText.trim()) return;
    
    setIsSubmitting(true);
    try {
      let imageUrl: string | null | undefined = undefined;
      if (editingNoteImage) {
        const file = editFileInputRef.current?.files?.[0];
        if (file) {
          imageUrl = await uploadImage(file);
        }
      }
      await updateNoteMutation.mutateAsync({ 
        id: editingNoteId, 
        noteText: editingNoteText.trim(),
        imageUrl,
      });
    } finally {
      setIsSubmitting(false);
      if (editFileInputRef.current) {
        editFileInputRef.current.value = "";
      }
    }
  };

  const startEditing = (note: JobNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.noteText);
    setEditingNoteImage(note.imageUrl);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditingNoteText("");
    setEditingNoteImage(null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
  };

  if (!assignment) return null;

  const status = getJobStatus(assignment);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-job-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 flex-wrap" data-testid="text-job-dialog-title">
              <span>{client?.companyName || "Unknown Client"}</span>
              <Badge variant={status.variant} data-testid="badge-job-status">{status.label}</Badge>
            </DialogTitle>
            <DialogDescription data-testid="text-job-dialog-description">
              Job #{assignment.id.slice(-6).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Property</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-job-address">
                {formatAddress(client)}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Schedule</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-job-schedule">
                {assignment.day !== null 
                  ? format(parseLocalDate(assignment.scheduledDate), "MMMM d, yyyy")
                  : "Not scheduled"
                }
                {assignment.scheduledHour !== null && ` at ${assignment.scheduledHour}:00`}
              </p>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Notes</h3>
              </div>

              {isLoadingNotes ? (
                <p className="text-sm text-muted-foreground">Loading notes...</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-muted-foreground mb-4">No notes yet</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {notes.map((note) => (
                    <div key={note.id} className="border rounded-lg p-3 space-y-2" data-testid={`note-${note.id}`}>
                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            className="resize-none text-sm"
                            rows={3}
                            data-testid="input-edit-note"
                          />
                          {(editingNoteImage || note.imageUrl) && (
                            <div className="relative inline-block">
                              <img 
                                src={editingNoteImage || note.imageUrl || ""} 
                                alt="Note attachment" 
                                className="max-h-32 rounded border"
                              />
                              <Button
                                size="icon"
                                variant="destructive"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => setEditingNoteImage(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              ref={editFileInputRef}
                              onChange={handleEditImageSelect}
                              className="hidden"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => editFileInputRef.current?.click()}
                              data-testid="button-edit-add-image"
                            >
                              <Camera className="h-4 w-4 mr-1" />
                              {editingNoteImage ? "Change" : "Add"} Image
                            </Button>
                            <div className="flex-1" />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                              data-testid="button-cancel-edit"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={isSubmitting || !editingNoteText.trim()}
                              data-testid="button-save-edit"
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm flex-1" data-testid={`text-note-${note.id}`}>{note.noteText}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => startEditing(note)}
                                data-testid={`button-edit-note-${note.id}`}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deleteNoteMutation.mutate(note.id)}
                                data-testid={`button-delete-note-${note.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {note.imageUrl && (
                            <div>
                              <img 
                                src={note.imageUrl} 
                                alt="Note attachment" 
                                className="max-h-48 rounded border cursor-pointer hover:opacity-90"
                                onClick={() => window.open(note.imageUrl!, '_blank')}
                                data-testid={`img-note-${note.id}`}
                              />
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground" data-testid={`text-note-date-${note.id}`}>
                            {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            {note.updatedAt !== note.createdAt && " (edited)"}
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 border-t pt-4">
                <h4 className="text-sm font-medium">Add New Note</h4>
                <Textarea
                  placeholder="Enter note text..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="resize-none text-sm"
                  rows={3}
                  data-testid="input-new-note"
                />
                {newNoteImage && (
                  <div className="relative inline-block">
                    <img src={newNoteImage} alt="Preview" className="max-h-32 rounded border" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => {
                        setNewNoteImage(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-add-image"
                  >
                    <Camera className="h-4 w-4 mr-1" />
                    Add Image
                  </Button>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={isSubmitting || (!newNoteText.trim() && !newNoteImage)}
                    data-testid="button-add-note"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Note
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4 mt-4">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid="button-delete-job"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="dialog-delete-job-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Job
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All job data including notes and images will be permanently erased.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteJobMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
