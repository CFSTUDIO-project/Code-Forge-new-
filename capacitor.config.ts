import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.codeforge.app',
  appName: 'CODEFORGE',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 900, backgroundColor: '#0c0e13', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0c0e13' },
  },
};
export default config;
