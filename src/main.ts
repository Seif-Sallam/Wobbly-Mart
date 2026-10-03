import './ui/style.css';
import { applyCssPalette } from './palette';
import { App } from './app/app';

applyCssPalette(document.documentElement);
void new App().start();
