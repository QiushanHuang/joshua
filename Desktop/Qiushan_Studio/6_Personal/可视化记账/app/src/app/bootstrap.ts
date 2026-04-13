import { buildShell } from './shell';

export function bootstrapApp(target: HTMLElement): void {
  target.innerHTML = '';
  target.appendChild(buildShell());
}
