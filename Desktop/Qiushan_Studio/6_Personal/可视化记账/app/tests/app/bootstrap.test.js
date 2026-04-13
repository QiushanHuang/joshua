import { describe, expect, it } from 'vitest';
import { buildShell } from '../../src/app/shell';
describe('buildShell', () => {
    it('renders the app frame with a loading banner', () => {
        const element = buildShell();
        expect(element.dataset.appShell).toBe('true');
        expect(element.querySelector('[data-role="boot-status"]')?.textContent).toContain('Loading local book');
    });
});
