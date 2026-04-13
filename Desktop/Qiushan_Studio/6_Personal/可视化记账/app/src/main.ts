import { bootstrapApp } from './app/bootstrap';
import './styles/base.css';

const target = document.getElementById('app');

if (!target) {
  throw new Error('Missing #app mount node');
}

bootstrapApp(target);
