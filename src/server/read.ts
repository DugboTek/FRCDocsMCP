import type { DocsBundle } from "./loader.js";
import type { DocPage } from "../shared/types.js";

export function readDoc(
  bundle: DocsBundle,
  id: string
): DocPage | null {
  return bundle.pages.get(id) || null;
}
