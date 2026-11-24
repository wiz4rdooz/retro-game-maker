// nur der lateinische Zeichensatz (reicht für Deutsch), hält die Web-Version klein
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import './app/theme.css';
import { render } from 'preact';
import { App, createAppCtx } from './app/App';
import { installTestHooks } from './app/testHooks';
import { createEditorState } from './state/editorState';
import { effect } from '@preact/signals';
import { applyUiScale, prefs } from './state/prefs';

effect(() => applyUiScale(prefs.value.uiScale));
const ctx = createAppCtx(createEditorState());
render(<App ctx={ctx} />, document.getElementById('app')!);
installTestHooks(ctx);
