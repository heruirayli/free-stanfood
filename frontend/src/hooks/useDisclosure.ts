import { useCallback, useState, type SyntheticEvent } from "react";

// Open/closed state for a collapsible section, so its contents can render only
// while it's open. A closed <details> hides its content but still keeps it in the
// page; with this, a closed section costs just its summary. Not tied to <details>:
// `isOpen`/`setOpen` work for any disclosure UI.
export const useDisclosure = (initiallyOpen = false) => {
  const [isOpen, setOpen] = useState(initiallyOpen);
  const onToggle = useCallback((event: SyntheticEvent<HTMLDetailsElement>) => setOpen(event.currentTarget.open), []);
  return { isOpen, setOpen, detailsProps: { open: isOpen, onToggle } };
};
