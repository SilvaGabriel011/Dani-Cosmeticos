import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.danicosmeticos.app',
  appName: 'Dani Cosméticos',
  webDir: 'out',
  server: {
    url: 'https://dani-cosmeticos.vercel.app',
    cleartext: true,
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#000000'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#000000',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      spinnerColor: '#ffffff'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000'
    }
  }
};

export default config;
