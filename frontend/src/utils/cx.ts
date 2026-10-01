// Joins class names, skipping falsy ones. Stands in for clsx, which the Kokonut UI
// components use, so the adapted components don't need an extra dependency.
export const cx = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(" ");
