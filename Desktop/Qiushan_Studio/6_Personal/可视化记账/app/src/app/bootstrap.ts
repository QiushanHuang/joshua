import { loadOrCreateLocalBook } from '../domain/bootstrap/loadOrCreateLocalBook';
import { AssetTrackerDb } from '../storage/db';
import { buildShell } from './shell';

let activeDb: AssetTrackerDb | null = null;

export function closeBootstrapDb(): void {
  activeDb?.close();
  activeDb = null;
}

export async function bootstrapApp(target: HTMLElement): Promise<void> {
  target.innerHTML = '';
  const shell = buildShell();
  target.appendChild(shell);

  const bootStatus = shell.querySelector<HTMLElement>('[data-role="boot-status"]');
  closeBootstrapDb();

  const db = new AssetTrackerDb();
  try {
    await db.open();
    const book = await loadOrCreateLocalBook(db);
    activeDb = db;

    if (bootStatus) {
      bootStatus.textContent = `Loaded ${book.name}`;
    }
  } catch (error) {
    db.close();
    throw error;
  }
}
