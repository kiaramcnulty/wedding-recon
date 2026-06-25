/**
 * Client-side persistence for an in-progress recon submitted by a guest.
 *
 * When a guest publishes, they're sent a magic link by email; clicking it opens
 * a fresh page (often a new tab), so the form — including photo File objects —
 * must survive a full reload. IndexedDB stores File/Blob natively (no base64
 * bloat, generous quota) and is per-origin, so the draft is readable from any
 * tab in the same browser. It does NOT cross devices — that's the documented
 * limit of the "open the link on this device" flow.
 *
 * A tiny localStorage flag (`RESUME_FLAG_KEY`) signals that a publish is pending
 * so the ResumePublishWatcher can route the user to /add?resume=1 once they
 * authenticate, wherever they happen to land first (onboarding → explore → …).
 */

const DB_NAME = "wedding-recon";
const STORE = "drafts";
const DRAFT_KEY = "pending-recon";

export const RESUME_FLAG_KEY = "wr:recon-resume";
/** Drafts older than this are treated as abandoned and ignored on resume. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** The serialised recon, kept verbatim so resume publishes identical data. */
export interface ReconDraft {
  /** The `__input` payload passed to the createRecon server action. */
  payload: Record<string, unknown>;
  /** Vendor selection state, so the editable form can be rehydrated on failure. */
  vendorState: Record<string, unknown>;
  /** Photo files — survive structured clone as File (name + type intact). */
  images: File[];
  savedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveReconDraft(
  draft: Omit<ReconDraft, "savedAt">,
): Promise<void> {
  // Stamp here (not in the component) so callers don't invoke Date.now() in
  // render scope, and so a re-save always refreshes the TTL window.
  const record: ReconDraft = { ...draft, savedAt: Date.now() };
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record, DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadReconDraft(): Promise<ReconDraft | null> {
  const db = await openDB();
  try {
    return await new Promise<ReconDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(DRAFT_KEY);
      req.onsuccess = () => resolve((req.result as ReconDraft) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function clearReconDraft(): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function setResumeFlag(): void {
  try {
    localStorage.setItem(RESUME_FLAG_KEY, "1");
  } catch {
    /* storage may be unavailable (private mode); resume just won't auto-route */
  }
}

export function getResumeFlag(): boolean {
  try {
    return localStorage.getItem(RESUME_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearResumeFlag(): void {
  try {
    localStorage.removeItem(RESUME_FLAG_KEY);
  } catch {
    /* no-op */
  }
}
