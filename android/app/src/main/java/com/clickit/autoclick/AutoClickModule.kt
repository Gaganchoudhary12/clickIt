package com.clickit.autoclick

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class AutoClickModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AutoClicker"

  @ReactMethod
  fun getStatus(promise: Promise) {
    val service = AutoClickAccessibilityService.instance
    val settings = AutoClickSettings.read(reactContext)
    val status = WritableNativeMap().apply {
      putBoolean("accessibilityEnabled", isAccessibilityServiceEnabled(reactContext))
      putBoolean("serviceConnected", service != null)
      putBoolean("controlsVisible", service?.controlsVisible == true)
      putBoolean("clicking", service?.isClicking == true)
      putDouble("intervalMs", settings.intervalMs.toDouble())
      putDouble("radiusDp", settings.radiusDp.toDouble())
    }
    promise.resolve(status)
  }

  @ReactMethod
  fun openAccessibilitySettings(promise: Promise) {
    try {
      reactContext.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        },
      )
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("OPEN_SETTINGS_FAILED", "Could not open Accessibility settings.", error)
    }
  }

  @ReactMethod
  fun showControls(intervalMs: Double, radiusDp: Double, promise: Promise) {
    val settings = AutoClickSettings.save(
      reactContext,
      intervalMs.toLong(),
      radiusDp.toFloat(),
    )
    withService(promise) { service ->
      service.updateSettings(settings)
      service.showControls()
      true
    }
  }

  @ReactMethod
  fun hideControls(promise: Promise) {
    withService(promise) { service ->
      service.hideControls()
      true
    }
  }

  @ReactMethod
  fun updateSettings(intervalMs: Double, radiusDp: Double, promise: Promise) {
    val settings = AutoClickSettings.save(
      reactContext,
      intervalMs.toLong(),
      radiusDp.toFloat(),
    )

    val service = AutoClickAccessibilityService.instance
    if (service == null) {
      promise.resolve(true)
      return
    }

    service.runOnMain {
      try {
        service.updateSettings(settings)
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("UPDATE_SETTINGS_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun startClicking(promise: Promise) {
    withService(promise) { service ->
      service.startClicking()
      true
    }
  }

  @ReactMethod
  fun stopClicking(promise: Promise) {
    withService(promise) { service ->
      service.stopClicking()
      true
    }
  }

  private fun withService(
    promise: Promise,
    action: (AutoClickAccessibilityService) -> Any?,
  ) {
    val service = AutoClickAccessibilityService.instance
    if (service == null) {
      promise.reject(
        "SERVICE_NOT_CONNECTED",
        "Enable ClickIt in Android Accessibility settings first.",
      )
      return
    }

    service.runOnMain {
      try {
        promise.resolve(action(service))
      } catch (error: Exception) {
        promise.reject("AUTO_CLICK_FAILED", error.message, error)
      }
    }
  }

  private fun isAccessibilityServiceEnabled(context: Context): Boolean {
    val expectedComponent = ComponentName(context, AutoClickAccessibilityService::class.java)
    val enabledServices = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
    ) ?: return false

    val splitter = TextUtils.SimpleStringSplitter(':').apply {
      setString(enabledServices)
    }

    for (serviceName in splitter) {
      val component = ComponentName.unflattenFromString(serviceName) ?: continue
      if (component == expectedComponent) {
        return true
      }
    }
    return false
  }
}
