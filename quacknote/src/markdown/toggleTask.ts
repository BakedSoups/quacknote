export function toggleTask(
  markdown: string,
  offset: number,
  checked: boolean,
): string {
  // Only replace a valid task marker at the given position.
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !/^\[[ xX]\]$/.test(markdown.slice(offset, offset + 3))
  ) {
    return markdown;
  }

  return (
    markdown.slice(0, offset)
    + (checked ? "[x]" : "[ ]")
    + markdown.slice(offset + 3)
  );
}
