// Bundle Monaco locally instead of the CDN loader, so the config editor works
// on the offline kiosk. Imported lazily by Machine.tsx right before the editor
// chunk, so none of this reaches the boot path. Trimmed to the core editor API
// plus the ini contribution: the editor only ever opens klipper configs with
// language="ini", and the full monaco barrel costs megabytes of Pi storage
// and startup for languages that never render.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution';
import { loader } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

// The core editor.api module is the same type surface the wrapper expects;
// the full-barrel type only adds language contributions that self-register.
loader.config({ monaco: monaco as unknown as Monaco });
