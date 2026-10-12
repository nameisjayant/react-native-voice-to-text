package com.texttovoice

import com.facebook.react.bridge.ReactApplicationContext

class TextToVoiceModule(reactContext: ReactApplicationContext) :
  NativeTextToVoiceSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeTextToVoiceSpec.NAME
  }
}
