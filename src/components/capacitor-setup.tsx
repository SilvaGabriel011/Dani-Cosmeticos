'use client'

import { useEffect } from 'react'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'

export function CapacitorSetup() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const setupNativeFeatures = async () => {
        try {
          await StatusBar.setStyle({ style: Style.Dark })
          await StatusBar.setBackgroundColor({ color: '#000000' })
          await SplashScreen.hide()
        } catch (error) {
          console.log('Capacitor setup error:', error)
        }
      }

      setupNativeFeatures()
    }
  }, [])

  return null
}
