package com.clickit.autoclick

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.TextView
import android.widget.Toast
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

class AutoClickAccessibilityService : AccessibilityService() {
  private lateinit var windowManager: WindowManager
  private val mainHandler = Handler(Looper.getMainLooper())
  private val density by lazy { resources.displayMetrics.density }
  private val dragSlop by lazy { ViewConfiguration.get(this).scaledTouchSlop }

  private var settings = ClickSettings(intervalMs = 1_000L, radiusDp = 12f)
  private var bubbleView: TextView? = null
  private var targetView: TargetView? = null
  private var bubbleParams: WindowManager.LayoutParams? = null
  private var targetParams: WindowManager.LayoutParams? = null
  private var running = false

  val controlsVisible: Boolean
    get() = bubbleView != null && targetView != null

  val isClicking: Boolean
    get() = running

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    settings = AutoClickSettings.read(this)
    running = false

    if (AutoClickSettings.preferences(this)
        .getBoolean(AutoClickSettings.KEY_CONTROLS_VISIBLE, false)
    ) {
      mainHandler.post { showControls() }
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

  override fun onInterrupt() {
    stopClicking(showToast = false)
  }

  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    mainHandler.post {
      clampOverlayToScreen(bubbleParams)
      clampOverlayToScreen(targetParams)
      updateOverlay(bubbleView, bubbleParams)
      updateOverlay(targetView, targetParams)
    }
  }

  override fun onDestroy() {
    stopClicking(showToast = false)
    removeOverlay(bubbleView)
    removeOverlay(targetView)
    bubbleView = null
    targetView = null
    bubbleParams = null
    targetParams = null
    if (instance === this) {
      instance = null
    }
    super.onDestroy()
  }

  fun runOnMain(action: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      action()
    } else {
      mainHandler.post(action)
    }
  }

  internal fun updateSettings(newSettings: ClickSettings) {
    settings = newSettings
    resizeTarget()
  }

  fun showControls() {
    if (controlsVisible) {
      return
    }

    val bounds = screenBounds()
    val bubbleSize = dp(64f)
    val targetSize = targetSizePx()
    val prefs = AutoClickSettings.preferences(this)

    val createdTarget = TargetView().apply {
      contentDescription = getString(com.clickit.R.string.target_content_description)
      updateRadius(settings.radiusDp)
    }
    val createdBubble = createBubble()

    val createdTargetParams = overlayParams(targetSize, targetSize).apply {
      x = prefs.getInt(
        AutoClickSettings.KEY_TARGET_X,
        bounds.width() / 2 - targetSize / 2,
      )
      y = prefs.getInt(
        AutoClickSettings.KEY_TARGET_Y,
        bounds.height() / 2 - targetSize / 2,
      )
    }
    val createdBubbleParams = overlayParams(bubbleSize, bubbleSize).apply {
      x = prefs.getInt(
        AutoClickSettings.KEY_BUBBLE_X,
        bounds.width() - bubbleSize - dp(16f),
      )
      y = prefs.getInt(
        AutoClickSettings.KEY_BUBBLE_Y,
        bounds.height() / 2 - bubbleSize / 2,
      )
    }

    bubbleView = createdBubble
    targetView = createdTarget
    bubbleParams = createdBubbleParams
    targetParams = createdTargetParams
    clampOverlayToScreen(createdTargetParams)
    clampOverlayToScreen(createdBubbleParams)

    attachDragHandler(
      view = createdTarget,
      params = createdTargetParams,
      xKey = AutoClickSettings.KEY_TARGET_X,
      yKey = AutoClickSettings.KEY_TARGET_Y,
    )
    attachDragHandler(
      view = createdBubble,
      params = createdBubbleParams,
      xKey = AutoClickSettings.KEY_BUBBLE_X,
      yKey = AutoClickSettings.KEY_BUBBLE_Y,
      onTap = { toggleClicking() },
    )

    windowManager.addView(createdTarget, createdTargetParams)
    windowManager.addView(createdBubble, createdBubbleParams)
    prefs.edit().putBoolean(AutoClickSettings.KEY_CONTROLS_VISIBLE, true).apply()
    updateRunningAppearance()
  }

  fun hideControls() {
    stopClicking(showToast = false)
    removeOverlay(bubbleView)
    removeOverlay(targetView)
    bubbleView = null
    targetView = null
    bubbleParams = null
    targetParams = null
    AutoClickSettings.preferences(this).edit()
      .putBoolean(AutoClickSettings.KEY_CONTROLS_VISIBLE, false)
      .apply()
  }

  fun startClicking() {
    if (!controlsVisible) {
      showControls()
    }
    if (running) {
      return
    }

    running = true
    setTargetTouchable(false)
    updateRunningAppearance()
    Toast.makeText(this, com.clickit.R.string.clicking_started, Toast.LENGTH_SHORT).show()
    performNextClick()
  }

  fun stopClicking() {
    stopClicking(showToast = true)
  }

  private fun stopClicking(showToast: Boolean) {
    if (!running) {
      return
    }
    running = false
    mainHandler.removeCallbacksAndMessages(CLICK_LOOP_TOKEN)
    setTargetTouchable(true)
    updateRunningAppearance()
    if (showToast) {
      Toast.makeText(this, com.clickit.R.string.clicking_stopped, Toast.LENGTH_SHORT).show()
    }
  }

  private fun toggleClicking() {
    if (running) stopClicking() else startClicking()
  }

  private fun performNextClick() {
    if (!running) {
      return
    }

    val point = randomClickPoint() ?: run {
      scheduleNextClick()
      return
    }
    val path = Path().apply { moveTo(point.first, point.second) }
    val gesture = GestureDescription.Builder()
      .addStroke(GestureDescription.StrokeDescription(path, 0, 45))
      .build()

    val dispatched = dispatchGesture(
      gesture,
      object : GestureResultCallback() {
        override fun onCompleted(gestureDescription: GestureDescription?) {
          scheduleNextClick()
        }

        override fun onCancelled(gestureDescription: GestureDescription?) {
          scheduleNextClick()
        }
      },
      mainHandler,
    )

    if (!dispatched) {
      scheduleNextClick()
    }
  }

  private fun scheduleNextClick() {
    if (!running) {
      return
    }
    mainHandler.postAtTime(
      { performNextClick() },
      CLICK_LOOP_TOKEN,
      android.os.SystemClock.uptimeMillis() + settings.intervalMs,
    )
  }

  private fun randomClickPoint(): Pair<Float, Float>? {
    val view = targetView ?: return null
    val location = IntArray(2)
    view.getLocationOnScreen(location)
    val centerX = location[0] + view.width / 2f
    val centerY = location[1] + view.height / 2f
    val radiusPx = dpFloat(settings.radiusDp)
    val bounds = screenBounds()

    repeat(8) {
      val distance = radiusPx * sqrt(Random.nextFloat())
      val angle = Random.nextDouble(0.0, 2.0 * PI)
      val x = (centerX + distance * cos(angle)).toFloat()
        .coerceIn(1f, max(1f, bounds.width() - 2f))
      val y = (centerY + distance * sin(angle)).toFloat()
        .coerceIn(1f, max(1f, bounds.height() - 2f))
      if (!isInsideBubble(x, y)) {
        return x to y
      }
    }
    return centerX to centerY
  }

  private fun isInsideBubble(x: Float, y: Float): Boolean {
    val view = bubbleView ?: return false
    val location = IntArray(2)
    view.getLocationOnScreen(location)
    return x >= location[0] && x <= location[0] + view.width &&
      y >= location[1] && y <= location[1] + view.height
  }

  private fun createBubble(): TextView = TextView(this).apply {
    gravity = Gravity.CENTER
    setTextColor(Color.WHITE)
    textSize = 25f
    elevation = dpFloat(10f)
    contentDescription = getString(com.clickit.R.string.control_content_description)
  }

  private fun attachDragHandler(
    view: View,
    params: WindowManager.LayoutParams,
    xKey: String,
    yKey: String,
    onTap: (() -> Unit)? = null,
  ) {
    var downRawX = 0f
    var downRawY = 0f
    var startX = 0
    var startY = 0
    var dragged = false

    view.setOnTouchListener { touchedView, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downRawX = event.rawX
          downRawY = event.rawY
          startX = params.x
          startY = params.y
          dragged = false
          true
        }

        MotionEvent.ACTION_MOVE -> {
          val deltaX = event.rawX - downRawX
          val deltaY = event.rawY - downRawY
          if (!dragged && (kotlin.math.abs(deltaX) > dragSlop ||
              kotlin.math.abs(deltaY) > dragSlop)
          ) {
            dragged = true
          }
          params.x = startX + deltaX.roundToInt()
          params.y = startY + deltaY.roundToInt()
          clampOverlayToScreen(params)
          updateOverlay(touchedView, params)
          true
        }

        MotionEvent.ACTION_UP -> {
          if (dragged) {
            AutoClickSettings.preferences(this).edit()
              .putInt(xKey, params.x)
              .putInt(yKey, params.y)
              .apply()
          } else {
            touchedView.performClick()
            onTap?.invoke()
          }
          true
        }

        MotionEvent.ACTION_CANCEL -> true
        else -> false
      }
    }
  }

  private fun overlayParams(width: Int, height: Int) = WindowManager.LayoutParams(
    width,
    height,
    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
    PixelFormat.TRANSLUCENT,
  ).apply {
    gravity = Gravity.TOP or Gravity.START
  }

  private fun setTargetTouchable(touchable: Boolean) {
    val params = targetParams ?: return
    params.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
    if (!touchable) {
      params.flags = params.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
    }
    updateOverlay(targetView, params)
  }

  private fun updateRunningAppearance() {
    val bubble = bubbleView ?: return
    bubble.text = if (running) "■" else "▶"
    bubble.background = circleDrawable(if (running) COLOR_STOP else COLOR_START)
    bubble.contentDescription = getString(
      if (running) com.clickit.R.string.stop_content_description
      else com.clickit.R.string.start_content_description,
    )
  }

  private fun resizeTarget() {
    val view = targetView ?: return
    val params = targetParams ?: return
    val oldCenterX = params.x + params.width / 2
    val oldCenterY = params.y + params.height / 2
    val newSize = targetSizePx()
    params.width = newSize
    params.height = newSize
    params.x = oldCenterX - newSize / 2
    params.y = oldCenterY - newSize / 2
    clampOverlayToScreen(params)
    view.updateRadius(settings.radiusDp)
    updateOverlay(view, params)
  }

  private fun targetSizePx(): Int = max(dp(56f), dp(settings.radiusDp * 2f + 24f))

  private fun clampOverlayToScreen(params: WindowManager.LayoutParams?) {
    params ?: return
    val bounds = screenBounds()
    params.x = params.x.coerceIn(0, max(0, bounds.width() - params.width))
    params.y = params.y.coerceIn(0, max(0, bounds.height() - params.height))
  }

  private fun updateOverlay(view: View?, params: WindowManager.LayoutParams?) {
    if (view == null || params == null || !view.isAttachedToWindow) {
      return
    }
    windowManager.updateViewLayout(view, params)
  }

  private fun removeOverlay(view: View?) {
    if (view?.isAttachedToWindow == true) {
      windowManager.removeView(view)
    }
  }

  private fun screenBounds(): Rect {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      return windowManager.currentWindowMetrics.bounds
    }
    @Suppress("DEPRECATION")
    val metrics = DisplayMetrics().also { windowManager.defaultDisplay.getRealMetrics(it) }
    return Rect(0, 0, metrics.widthPixels, metrics.heightPixels)
  }

  private fun circleDrawable(color: Int) = GradientDrawable().apply {
    shape = GradientDrawable.OVAL
    setColor(color)
    setStroke(dp(2f), Color.argb(90, 255, 255, 255))
  }

  private fun dp(value: Float): Int = dpFloat(value).roundToInt()

  private fun dpFloat(value: Float): Float = value * density

  private inner class TargetView : View(this) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var radiusPx = dpFloat(settings.radiusDp)

    fun updateRadius(radiusDp: Float) {
      radiusPx = dpFloat(radiusDp)
      invalidate()
    }

    override fun performClick(): Boolean {
      super.performClick()
      return true
    }

    override fun onDraw(canvas: Canvas) {
      super.onDraw(canvas)
      val centerX = width / 2f
      val centerY = height / 2f

      if (radiusPx > 0f) {
        paint.style = Paint.Style.FILL
        paint.color = Color.argb(42, 244, 114, 182)
        canvas.drawCircle(centerX, centerY, radiusPx, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = dpFloat(1.5f)
        paint.color = Color.argb(190, 244, 114, 182)
        canvas.drawCircle(centerX, centerY, radiusPx, paint)
      }

      paint.style = Paint.Style.FILL
      paint.color = COLOR_TARGET
      canvas.drawCircle(centerX, centerY, dpFloat(10f), paint)
      paint.style = Paint.Style.STROKE
      paint.strokeWidth = dpFloat(3f)
      paint.color = Color.WHITE
      canvas.drawCircle(centerX, centerY, dpFloat(5f), paint)
      paint.strokeWidth = dpFloat(2f)
      canvas.drawLine(centerX - dpFloat(16f), centerY, centerX - dpFloat(8f), centerY, paint)
      canvas.drawLine(centerX + dpFloat(8f), centerY, centerX + dpFloat(16f), centerY, paint)
      canvas.drawLine(centerX, centerY - dpFloat(16f), centerX, centerY - dpFloat(8f), paint)
      canvas.drawLine(centerX, centerY + dpFloat(8f), centerX, centerY + dpFloat(16f), paint)
    }
  }

  companion object {
    private const val COLOR_START = 0xFFB52B75.toInt()
    private const val COLOR_STOP = 0xFFC73C57.toInt()
    private const val COLOR_TARGET = 0xFFB52B75.toInt()
    private val CLICK_LOOP_TOKEN = Any()

    @Volatile
    var instance: AutoClickAccessibilityService? = null
      private set
  }
}
