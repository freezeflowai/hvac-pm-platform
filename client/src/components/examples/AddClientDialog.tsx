import AddClientDialog from '../AddClientDialog';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function AddClientDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Dialog</Button>
      <AddClientDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(data) => console.log('Client submitted:', data)}
      />
    </div>
  );
}
