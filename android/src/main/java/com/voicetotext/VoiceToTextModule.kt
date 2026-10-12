package com.voicetotext

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil

class VoiceToTextModule(reactContext: ReactApplicationContext) :
  NativeVoiceToTextSpec(reactContext) {

  // Only touched on the UI thread.
  private var recognizer: SpeechRecognizer? = null
  private var lastPartial: String = ""
  private var lastVolumeEmit = 0L

  override fun isAvailable(promise: Promise) {
    promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactApplicationContext))
  }

  override fun hasPermissions(promise: Promise) {
    promise.resolve(hasRecordPermission())
  }

  // Runtime permission prompts are handled from JS via PermissionsAndroid; this reports the current state.
  override fun requestPermissions(promise: Promise) {
    promise.resolve(hasRecordPermission())
  }

  override fun startListening(options: ReadableMap, promise: Promise) {
    if (!hasRecordPermission()) {
      promise.reject(ERROR_PERMISSION, "RECORD_AUDIO permission has not been granted")
      return
    }
    if (!SpeechRecognizer.isRecognitionAvailable(reactApplicationContext)) {
      promise.reject(ERROR_UNAVAILABLE, "Speech recognition is not available on this device")
      return
    }

    val locale = if (options.hasKey("locale") && !options.isNull("locale")) options.getString("locale") else null
    val onDevice = options.hasKey("onDevice") && !options.isNull("onDevice") && options.getBoolean("onDevice")
    val silenceMs =
      if (options.hasKey("silenceTimeout") && !options.isNull("silenceTimeout")) options.getDouble("silenceTimeout").toLong() else null

    UiThreadUtil.runOnUiThread {
      try {
        destroyRecognizer()
        lastPartial = ""

        val sr = SpeechRecognizer.createSpeechRecognizer(reactApplicationContext)
        sr.setRecognitionListener(listener)
        recognizer = sr

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
          putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, reactApplicationContext.packageName)
          if (locale != null) putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
          if (onDevice) putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
          // Hints only; many recognizers apply their own endpointing. JS enforces the real timeout.
          if (silenceMs != null) {
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, silenceMs)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, silenceMs)
          }
        }
        sr.startListening(intent)
        promise.resolve(null)
      } catch (e: Exception) {
        destroyRecognizer()
        promise.reject(ERROR_START, e.message ?: "Failed to start speech recognition", e)
      }
    }
  }

  override fun stopListening(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      recognizer?.stopListening()
      promise.resolve(null)
    }
  }

  override fun cancelListening(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      destroyRecognizer()
      promise.resolve(null)
    }
  }

  override fun invalidate() {
    UiThreadUtil.runOnUiThread { destroyRecognizer() }
    super.invalidate()
  }

  private val listener = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) {
      emitState("started")
    }

    override fun onBeginningOfSpeech() {}

    override fun onRmsChanged(rmsdB: Float) {
      val now = System.currentTimeMillis()
      if (now - lastVolumeEmit < VOLUME_THROTTLE_MS) return
      lastVolumeEmit = now
      // rmsdB is roughly -2..10 on most devices
      val normalized = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
      emitOnSpeechVolume(Arguments.createMap().apply { putDouble("value", normalized.toDouble()) })
    }

    override fun onBufferReceived(buffer: ByteArray?) {}

    override fun onEndOfSpeech() {}

    override fun onPartialResults(partialResults: Bundle?) {
      val text = firstResult(partialResults)
      if (text.isNullOrEmpty() || text == lastPartial) return
      lastPartial = text
      emitResult(text, false)
    }

    override fun onResults(results: Bundle?) {
      val text = firstResult(results) ?: lastPartial
      emitResult(text, true)
      finishSession()
    }

    override fun onError(error: Int) {
      val (code, message) = describeError(error)
      emitOnSpeechError(Arguments.createMap().apply {
        putString("code", code)
        putString("message", message)
      })
      finishSession()
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}
  }

  private fun finishSession() {
    destroyRecognizer()
    emitState("ended")
  }

  private fun destroyRecognizer() {
    recognizer?.let {
      it.setRecognitionListener(null)
      it.cancel()
      it.destroy()
    }
    recognizer = null
  }

  private fun emitState(state: String) {
    emitOnSpeechState(Arguments.createMap().apply { putString("state", state) })
  }

  private fun emitResult(text: String, isFinal: Boolean) {
    emitOnSpeechResult(Arguments.createMap().apply {
      putString("value", text)
      putBoolean("isFinal", isFinal)
    })
  }

  private fun firstResult(bundle: Bundle?): String? =
    bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()

  private fun hasRecordPermission(): Boolean =
    reactApplicationContext.checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
      PackageManager.PERMISSION_GRANTED

  private fun describeError(error: Int): Pair<String, String> = when (error) {
    SpeechRecognizer.ERROR_NO_MATCH -> "no_match" to "No speech was recognized"
    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "speech_timeout" to "No speech input"
    SpeechRecognizer.ERROR_AUDIO -> "audio" to "Audio recording error"
    SpeechRecognizer.ERROR_CLIENT -> "client" to "Client side error"
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> ERROR_PERMISSION to "Insufficient permissions"
    SpeechRecognizer.ERROR_NETWORK -> "network" to "Network error"
    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network_timeout" to "Network timeout"
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "busy" to "Recognition service is busy"
    SpeechRecognizer.ERROR_SERVER -> "server" to "Server error"
    else -> "unknown" to "Speech recognition error ($error)"
  }

  companion object {
    const val NAME = NativeVoiceToTextSpec.NAME
    private const val ERROR_PERMISSION = "permission_denied"
    private const val ERROR_UNAVAILABLE = "unavailable"
    private const val ERROR_START = "start_failed"
    private const val VOLUME_THROTTLE_MS = 80L
  }
}
