import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2, Plus, Camera, Edit2, X, AlertTriangle, Save, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import ClientReportDialog from "@/components/ClientReportDialog";

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
  location?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface Part {
  id: string;
  type: string;
  filterType?: string | null;
  beltType?: string | null;
  size?: string | null;
  name?: string | null;
}

interface ClientPart {
  id: string;
  partId: string;
  quantity: number;
  part?: Part;
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
  bulkParts?: Record<string, ClientPart[]>;
  onAssignTechnicians?: (assignmentId: string, technicianIds: string[]) => void;
}

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getPartDisplayName(part: Part): string {
  if (part.type === 'filter') {
    return `${part.filterType || 'Filter'} ${part.size || ''}`.trim();
  } else if (part.type === 'belt') {
    return `Belt ${part.beltType || ''} ${part.size || ''}`.trim();
  } else {
    return part.name || 'Other Part';
  }
}

export function JobDetailDialog({ 
  assignment, 
  client, 
  open, 
  onOpenChange, 
  bulkParts = {},
  onAssignTechnicians 
}: JobDetailDialogProps) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteImage, setNewNoteImage] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [editingNoteImage, setEditingNoteImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [reportClientId, setReportClientId] = useState<string | null>(null);

  useEffect(() => {
    if (assignment) {
      setSelectedTechs(assignment.assignedTechnicianIds || []);
      setIsCompleted(assignment.completed || false);
      if (assignment.day !== null && assignment.scheduledDate) {
        setSelectedDate(parseLocalDate(assignment.scheduledDate));
      } else {
        setSelectedDate(undefined);
      }
    } else {
      setSelectedTechs([]);
      setIsCompleted(false);
      setSelectedDate(undefined);
    }
  }, [assignment?.id, open]);

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ['/api/technicians'],
    enabled: open,
  });

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

  const clientParts = bulkParts[client?.id || ""] || [];

  const partsList = clientParts.map((cp) => ({
    quantity: cp.quantity || 1,
    description: cp.part ? getPartDisplayName(cp.part) : 'Unknown Part'
  }));

  const fullAddress = [
    client?.address,
    client?.city,
    client?.province,
    client?.postalCode
  ].filter(Boolean).join(', ');

  const toggleComplete = useMutation({
    mutationFn: async (completed: boolean) => {
      if (!assignment) return;
      return apiRequest("PATCH", `/api/calendar/assign/${assignment.id}`, { completed });
    },
    onSuccess: (_data, completed) => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/overdue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/statuses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/recently-completed'] });
      toast({
        title: completed ? "Marked as complete" : "Marked as incomplete",
        description: completed ? "Job marked as completed" : "Job moved back to active"
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  });

  const updateDate = useMutation({
    mutationFn: async (newDate: Date) => {
      if (!assignment) return;
      const year = newDate.getFullYear();
      const month = newDate.getMonth() + 1;
      const day = newDate.getDate();
      return apiRequest("PATCH", `/api/calendar/assign/${assignment.id}`, {
        year, month, day,
        scheduledDate: format(newDate, 'yyyy-MM-dd')
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/overdue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/unscheduled'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/statuses'] });
      toast({ title: "Date updated", description: "Job has been rescheduled" });
      setDatePickerOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update date", variant: "destructive" });
    }
  });

  const unscheduleJob = useMutation({
    mutationFn: async () => {
      if (!assignment) return;
      return apiRequest("PATCH", `/api/calendar/assign/${assignment.id}`, {
        day: null,
        scheduledHour: null
      });
    },
    onSuccess: () => {
      setSelectedDate(undefined);
      queryClient.invalidateQueries({ queryKey: ['/api/calendar'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/overdue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/unscheduled'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/statuses'] });
      toast({ title: "Job unscheduled", description: "Job has been removed from the calendar" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unschedule job", variant: "destructive" });
    }
  });

  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/calendar/assign/${assignment!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/overdue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled"] });
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
      if (imageUrl !== undefined) body.imageUrl = imageUrl;
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

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Image too large", description: "Maximum size is 5MB", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setNewNoteImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Image too large", description: "Maximum size is 5MB", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setEditingNoteImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim() && !newNoteImage) return;
    setIsSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (newNoteImage) {
        const file = fileInputRef.current?.files?.[0];
        if (file) imageUrl = await uploadImage(file);
      }
      await createNoteMutation.mutateAsync({ noteText: newNoteText.trim() || "Image note", imageUrl });
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editingNoteText.trim()) return;
    setIsSubmitting(true);
    try {
      let imageUrl: string | null | undefined = undefined;
      if (editingNoteImage && editFileInputRef.current?.files?.[0]) {
        imageUrl = await uploadImage(editFileInputRef.current.files[0]);
      }
      await updateNoteMutation.mutateAsync({ id: editingNoteId, noteText: editingNoteText.trim(), imageUrl });
    } finally {
      setIsSubmitting(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
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
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      updateDate.mutate(date);
    }
  };

  const handleToggleComplete = () => {
    const newStatus = !isCompleted;
    setIsCompleted(newStatus);
    toggleComplete.mutate(newStatus);
  };

  const handleTechnicianToggle = (techId: string) => {
    if (!assignment || !onAssignTechnicians) return;
    const newTechs = selectedTechs.includes(techId)
      ? selectedTechs.filter(id => id !== techId)
      : [...selectedTechs, techId];
    setSelectedTechs(newTechs);
    onAssignTechnicians(assignment.id, newTechs);
  };

  if (!assignment) return null;

  const hasScheduledDay = selectedDate || (assignment.day != null);
  const scheduledDate = hasScheduledDay && (selectedDate || assignment.scheduledDate) 
    ? (selectedDate || parseLocalDate(assignment.scheduledDate)) 
    : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = scheduledDate && scheduledDate < today && !assignment.completed;
  const isUnscheduled = !hasScheduledDay && !assignment.completed;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-job-detail">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            data-testid="button-close-dialog"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>

          <DialogHeader>
            <DialogTitle className="text-base font-semibold pr-6" data-testid="text-job-dialog-title">
              {client?.companyName || "Unknown Client"} - Preventive Maintenance
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Job #{assignment.id.slice(-6).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="completed"
                checked={isCompleted}
                onCheckedChange={handleToggleComplete}
                data-testid="checkbox-completed"
              />
              <label
                htmlFor="completed"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Completed
              </label>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">Details</h3>
              <div className="flex gap-2 text-sm">
                <span 
                  className="text-primary hover:underline cursor-pointer" 
                  onClick={() => setReportClientId(client?.id || null)}
                  data-testid="link-client-details"
                >
                  {client?.companyName}
                </span>
                <span className="text-muted-foreground">-</span>
                <span className="text-muted-foreground" data-testid="text-job-id">
                  Job #{assignment.id.slice(-6).toUpperCase()}
                </span>
              </div>
            </div>

            {onAssignTechnicians && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Team</h3>
                <div className="space-y-2">
                  {selectedTechs.map((techId) => {
                    const tech = technicians.find((t: any) => t.id === techId);
                    if (!tech) return null;
                    const techName = tech.firstName && tech.lastName 
                      ? `${tech.firstName} ${tech.lastName}` 
                      : tech.email;
                    return (
                      <div 
                        key={techId} 
                        className="flex items-center justify-between gap-2 text-sm p-2 rounded border"
                        data-testid={`team-member-${techId}`}
                      >
                        <span>{techName}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleTechnicianToggle(techId)}
                          data-testid={`button-remove-tech-${techId}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => {
                      const availableTechs = technicians.filter((t: any) => !selectedTechs.includes(t.id));
                      if (availableTechs.length > 0) {
                        handleTechnicianToggle(availableTechs[0].id);
                      }
                    }}
                    data-testid="button-add-technician"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {fullAddress && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Location</h3>
                <p className="text-sm" data-testid="text-location">{fullAddress}</p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-2">Status</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge 
                  variant={isOverdue ? "destructive" : assignment.completed ? "default" : isUnscheduled ? "outline" : "secondary"}
                  className="flex items-center gap-1"
                  data-testid="badge-job-status"
                >
                  {isOverdue && <AlertCircle className="h-3 w-3" />}
                  {assignment.completed ? "Completed" : isOverdue ? "Overdue" : isUnscheduled ? "Unscheduled" : "Scheduled"}
                </Badge>

                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-7 gap-1"
                      data-testid="button-change-date"
                    >
                      <CalendarIcon className="h-3 w-3" />
                      {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {hasScheduledDay && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    onClick={() => unscheduleJob.mutate()}
                    disabled={unscheduleJob.isPending}
                    data-testid="button-unschedule"
                  >
                    Unschedule
                  </Button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Parts</h3>
              <div className="space-y-2 bg-muted/30 rounded-md p-3">
                {partsList.length > 0 ? (
                  partsList.map((item, index) => (
                    <div 
                      key={index} 
                      className="flex justify-between text-sm"
                      data-testid={`part-item-${index}`}
                    >
                      <span>{item.description}</span>
                      <span className="font-medium">{item.quantity}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No parts assigned</p>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Notes</h3>
              </div>

              {isLoadingNotes ? (
                <p className="text-sm text-muted-foreground">Loading notes...</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-muted-foreground mb-3">No notes yet</p>
              ) : (
                <div className="space-y-3 mb-3">
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
                            <input type="file" accept="image/*" ref={editFileInputRef} onChange={handleEditImageSelect} className="hidden" />
                            <Button size="sm" variant="outline" onClick={() => editFileInputRef.current?.click()} data-testid="button-edit-add-image">
                              <Camera className="h-4 w-4 mr-1" />
                              {editingNoteImage ? "Change" : "Add"} Image
                            </Button>
                            <div className="flex-1" />
                            <Button size="sm" variant="outline" onClick={cancelEditing} data-testid="button-cancel-edit">Cancel</Button>
                            <Button size="sm" onClick={handleSaveEdit} disabled={isSubmitting || !editingNoteText.trim()} data-testid="button-save-edit">
                              <Save className="h-4 w-4 mr-1" />Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm flex-1" data-testid={`text-note-${note.id}`}>{note.noteText}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditing(note)} data-testid={`button-edit-note-${note.id}`}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteNoteMutation.mutate(note.id)} data-testid={`button-delete-note-${note.id}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {note.imageUrl && (
                            <img src={note.imageUrl} alt="Note attachment" className="max-h-48 rounded border cursor-pointer hover:opacity-90" onClick={() => window.open(note.imageUrl!, '_blank')} data-testid={`img-note-${note.id}`} />
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

              <div className="space-y-2 border-t pt-3">
                <h4 className="text-sm font-medium">Add New Note</h4>
                <Textarea
                  placeholder="Enter note text..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="resize-none text-sm"
                  rows={2}
                  data-testid="input-new-note"
                />
                {newNoteImage && (
                  <div className="relative inline-block">
                    <img src={newNoteImage} alt="Preview" className="max-h-32 rounded border" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => { setNewNoteImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-add-image">
                    <Camera className="h-4 w-4 mr-1" />Add Image
                  </Button>
                  <div className="flex-1" />
                  <Button size="sm" onClick={handleAddNote} disabled={isSubmitting || (!newNoteText.trim() && !newNoteImage)} data-testid="button-add-note">
                    <Plus className="h-4 w-4 mr-1" />Add Note
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                data-testid="button-delete-job"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Job
              </Button>
            </div>
          </div>
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

      <ClientReportDialog
        clientId={reportClientId}
        open={!!reportClientId}
        onOpenChange={(open) => { if (!open) setReportClientId(null); }}
      />
    </>
  );
}
