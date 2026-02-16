import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.danicosmeticos.app',
  appName: 'Dani Cosméticos',
  webDir: 'out',
  server: {
    url: 'https://dani-cosmeticos.vercel.app',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
