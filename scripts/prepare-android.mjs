import { copyFile, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const manifest = path.join(projectRoot, 'android/app/src/main/AndroidManifest.xml');
if (!existsSync(manifest)) {
  throw new Error('Android project is missing. Run "npx cap add android" before this script.');
}

let xml = await readFile(manifest, 'utf8');
xml = xml.replace(/<activity\b([^>]*)>/, (full, attrs) => {
  if (/android:screenOrientation=/.test(attrs)) return `<activity${attrs.replace(/android:screenOrientation="[^"]+"/, 'android:screenOrientation="landscape"')}>`;
  return `<activity${attrs} android:screenOrientation="landscape">`;
});
xml = xml.replace(/android:label="[^"]*"/, 'android:label="CODEFORGE"');
await writeFile(manifest, xml, 'utf8');

for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  const sourceDir = path.join(projectRoot, `assets/android-icons/mipmap-${density}`);
  const destinationDir = path.join(projectRoot, `android/app/src/main/res/mipmap-${density}`);
  await mkdir(destinationDir, { recursive: true });
  for (const icon of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    await copyFile(path.join(sourceDir, icon), path.join(destinationDir, icon));
  }
}
const valuesDir = path.join(projectRoot, 'android/app/src/main/res/values');
await mkdir(valuesDir, { recursive: true });
await writeFile(path.join(valuesDir, 'codeforge_launcher.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="codeforge_launcher_bg">#0A0D14</color></resources>\n', 'utf8');
const adaptiveDir = path.join(projectRoot, 'android/app/src/main/res/mipmap-anydpi-v26');
await mkdir(adaptiveDir, { recursive: true });
const adaptiveXml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/codeforge_launcher_bg"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>\n';
await writeFile(path.join(adaptiveDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
await writeFile(path.join(adaptiveDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

console.log('Android manifest set to landscape; CODEFORGE adaptive and legacy launcher icons copied.');
