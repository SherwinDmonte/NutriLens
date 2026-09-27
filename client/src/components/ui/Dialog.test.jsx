import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Dialog } from './Dialog.jsx';

function StatefulDialog({ onClose, closeDisabled = false }) {
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      title="Recipe details"
      closeDisabled={closeDisabled}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
    >
      <p>Dialog content</p>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('handles a native cancel request exactly once', async () => {
    const onClose = vi.fn();
    render(<StatefulDialog onClose={onClose} />);
    const dialog = screen.getByRole('dialog');

    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));

    await waitFor(() => expect(dialog.open).toBe(false));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open when closing is disabled', () => {
    const onClose = vi.fn();
    render(<StatefulDialog onClose={onClose} closeDisabled />);
    const dialog = screen.getByRole('dialog');

    const cancelEvent = new Event('cancel', { bubbles: false, cancelable: true });
    fireEvent(dialog, cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});
