// Gaijin prefixes vehicle names with marker glyphs (control pictures like ␗,
// geometric shapes like ◊/■, block elements like ▀) that render as tofu in
// most fonts. Strip them for display; the raw name stays canonical in data.
const MARKER_GLYPHS = /^[␀-␿■-◿▀-▟⋠-⋣]+\s*/

export function displayVehicleName(name: string): string {
  return name.replace(MARKER_GLYPHS, '') || name
}
