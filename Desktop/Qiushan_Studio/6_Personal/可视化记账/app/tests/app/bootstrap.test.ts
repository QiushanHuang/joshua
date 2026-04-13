import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapApp, closeBootstrapDb } from '../../src/app/bootstrap';
import * as bootstrapDomain from '../../src/domain/bootstrap/loadOrCreateLocalBook';
import { AssetTrackerDb } from '../../src/storage/db';

describe('bootstrapApp', () => {
  beforeEach(async () => {
    const db = new AssetTrackerDb();
    await db.delete();
    db.close();
  });

  afterEach(async () => {
    closeBootstrapDb();
    const db = new AssetTrackerDb();
    await db.delete();
    db.close();
  });

  it('clears the target and appends the app shell', async () => {
    const target = document.createElement('div');
    const staleNode = document.createElement('span');

    staleNode.textContent = 'stale';
    target.appendChild(staleNode);

    await bootstrapApp(target);

    const shell = target.firstElementChild as HTMLElement | null;

    expect(target.childElementCount).toBe(1);
    expect(shell?.dataset.appShell).toBe('true');
    expect(target.querySelector('[data-role="boot-status"]')?.textContent).toContain('Loaded Local Book');
    expect(target.textContent).not.toContain('stale');
  });

  it('closes the db handle if bootstrap fails after opening the database', async () => {
    const target = document.createElement('div');
    const closeSpy = vi.spyOn(AssetTrackerDb.prototype, 'close');
    const loadSpy = vi
      .spyOn(bootstrapDomain, 'loadOrCreateLocalBook')
      .mockRejectedValueOnce(new Error('boot failed'));

    await expect(bootstrapApp(target)).rejects.toThrow('boot failed');
    expect(closeSpy).toHaveBeenCalled();

    loadSpy.mockRestore();
    closeSpy.mockRestore();
  });
});
