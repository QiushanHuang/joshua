import { buildShell } from './shell';
export function bootstrapApp(target) {
    target.innerHTML = '';
    target.appendChild(buildShell());
}
