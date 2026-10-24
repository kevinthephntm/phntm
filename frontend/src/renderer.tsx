import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Preview } from './Preview';
import './index.css';

document.body.classList.toggle('preview-page', !window.bar);
createRoot(document.getElementById('root')!).render(
  window.bar ? <App /> : <Preview />,
);
