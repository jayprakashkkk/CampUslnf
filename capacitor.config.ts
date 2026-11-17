import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jayprakashkkk.campus',
  appName: 'CampUs',
  webDir: 'mobile/www',
  backgroundColor: '#FFF8EF',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#FFF8EF',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FFF8EF',
      overlaysWebView: false
    }
  }
};

export default config;
