package com.clickit.autoclick

import android.content.Context

internal data class ClickSettings(
  val intervalMs: Long,
  val radiusDp: Float,
)

internal object AutoClickSettings {
  const val MIN_INTERVAL_MS = 100L
  const val MAX_INTERVAL_MS = 60_000L
  const val MIN_RADIUS_DP = 0f
  const val MAX_RADIUS_DP = 100f

  private const val PREFS_NAME = "clickit_auto_clicker"
  private const val KEY_INTERVAL_MS = "interval_ms"
  private const val KEY_RADIUS_DP = "radius_dp"
  const val KEY_CONTROLS_VISIBLE = "controls_visible"
  const val KEY_TARGET_X = "target_x"
  const val KEY_TARGET_Y = "target_y"
  const val KEY_BUBBLE_X = "bubble_x"
  const val KEY_BUBBLE_Y = "bubble_y"

  fun preferences(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun read(context: Context): ClickSettings {
    val prefs = preferences(context)
    return ClickSettings(
      intervalMs = prefs.getLong(KEY_INTERVAL_MS, 1_000L)
        .coerceIn(MIN_INTERVAL_MS, MAX_INTERVAL_MS),
      radiusDp = prefs.getFloat(KEY_RADIUS_DP, 12f)
        .coerceIn(MIN_RADIUS_DP, MAX_RADIUS_DP),
    )
  }

  fun save(context: Context, intervalMs: Long, radiusDp: Float): ClickSettings {
    val settings = ClickSettings(
      intervalMs = intervalMs.coerceIn(MIN_INTERVAL_MS, MAX_INTERVAL_MS),
      radiusDp = radiusDp.coerceIn(MIN_RADIUS_DP, MAX_RADIUS_DP),
    )

    preferences(context).edit()
      .putLong(KEY_INTERVAL_MS, settings.intervalMs)
      .putFloat(KEY_RADIUS_DP, settings.radiusDp)
      .apply()

    return settings
  }
}
