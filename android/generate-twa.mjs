/**
 * Gera o projeto Android (Trusted Web Activity) do WishWatch com o Bubblewrap.
 * Usado pelo workflow .github/workflows/android.yml.
 *
 * Variáveis de ambiente:
 *   APP_URL       URL pública do app (ex.: https://wishwatch.onrender.com)  [obrigatória]
 *   VERSION_CODE  número inteiro crescente da versão (padrão: 1)
 *   VERSION_NAME  nome da versão (padrão: 1.0.<VERSION_CODE>)
 *   ICON_BASE     de onde baixar os ícones (padrão: arquivos public/ do repositório no GitHub)
 *   OUT_DIR       pasta de saída (padrão: android/build/twa)
 */
import { TwaGenerator, TwaManifest, ConsoleLog } from '@bubblewrap/core';
import path from 'path';
import fs from 'fs';

const appUrl = process.env.APP_URL?.trim().replace(/\/$/, '');
if (!appUrl || !/^https:\/\//.test(appUrl)) {
  console.error('Defina APP_URL com a URL https do app (ex.: https://wishwatch.onrender.com).');
  process.exit(1);
}

const host = new URL(appUrl).host;
const versionCode = Number(process.env.VERSION_CODE || 1);
const versionName = process.env.VERSION_NAME || `1.0.${versionCode}`;
const iconBase = (
  process.env.ICON_BASE || 'https://raw.githubusercontent.com/Riizzi/WishWatch/main/public'
).replace(/\/$/, '');
const outDir = path.resolve(process.env.OUT_DIR || 'android/build/twa');

const manifest = new TwaManifest({
  packageId: 'io.github.riizzi.wishwatch',
  host,
  name: 'WishWatch',
  launcherName: 'WishWatch',
  display: 'standalone',
  orientation: 'portrait',
  themeColor: '#FAF7F2',
  themeColorDark: '#FAF7F2',
  navigationColor: '#FAF7F2',
  navigationColorDark: '#FAF7F2',
  navigationDividerColor: '#E8DFD1',
  navigationDividerColorDark: '#E8DFD1',
  backgroundColor: '#FAF7F2',
  enableNotifications: true,
  startUrl: '/',
  iconUrl: `${iconBase}/pwa-512x512.png`,
  maskableIconUrl: `${iconBase}/pwa-maskable-512x512.png`,
  monochromeIconUrl: `${iconBase}/pwa-monochrome-512x512.png`,
  splashScreenFadeOutDuration: 300,
  signingKey: { path: path.resolve('android/wishwatch.keystore'), alias: 'wishwatch' },
  appVersionCode: versionCode,
  appVersion: versionName,
  shortcuts: [],
  generatorApp: 'bubblewrap-cli',
  fallbackType: 'customtabs',
  features: {},
  alphaDependencies: { enabled: false },
  enableSiteSettingsShortcut: true,
  isChromeOSOnly: false,
  isMetaQuest: false,
  fullScopeUrl: `${appUrl}/`,
  minSdkVersion: 21,
  fingerprints: [],
  additionalTrustedOrigins: [],
  retainedBundles: [],
});

const problem = manifest.validate();
if (problem) {
  console.error('Manifesto TWA inválido:', problem);
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
await new TwaGenerator().createTwaProject(outDir, manifest, new ConsoleLog('twa'));
await manifest.saveToFile(path.join(outDir, 'twa-manifest.json'));

// Ícone adaptativo próprio: fundo cinza + olho em vetor, com camada monocromática
// para os ícones temáticos do Android 13+ (o padrão do Bubblewrap usa fundo branco).
const res = path.join(outDir, 'app/src/main/res');
const EYE = [
  // lente (olho) com o anel vazado
  '<path android:fillColor="#1C1C1C" android:fillType="evenOdd" android:pathData="M29,54 A28.6,28.6 0 0 1 79,54 A28.6,28.6 0 0 1 29,54 Z M63.56,54 A9.56,9.56 0 1 0 44.44,54 A9.56,9.56 0 1 0 63.56,54 Z"/>',
  // pupila
  '<path android:fillColor="#1C1C1C" android:pathData="M59.5,54 A5.5,5.5 0 1 0 48.5,54 A5.5,5.5 0 1 0 59.5,54 Z"/>',
].join('\n    ');

fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
fs.writeFileSync(
  path.join(res, 'drawable/ic_launcher_foreground.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
    ${EYE}
</vector>
`
);
fs.writeFileSync(
  path.join(res, 'drawable/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#8A8A8A"/>
</shape>
`
);
fs.writeFileSync(
  path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`
);
console.log(`Projeto Android gerado em ${outDir} (host ${host}, versão ${versionName} / ${versionCode})`);
