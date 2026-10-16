package gr.grafida.prismasnip

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityService.ScreenshotResult
import android.accessibilityservice.AccessibilityService.TakeScreenshotCallback
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.graphics.Point
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.view.Display
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.animation.DecelerateInterpolator
import android.widget.Toast
import java.io.File
import kotlin.concurrent.thread
import kotlin.math.hypot

/**
 * Υπηρεσία προσβασιμότητας: κρατά το αιωρούμενο ψαλίδι πάνω από όλες τις εφαρμογές
 * και τραβά στιγμιότυπο χωρίς ερώτηση κάθε φορά (σε αντίθεση με την «εγγραφή οθόνης»).
 */
class SnipService : AccessibilityService() {
    companion object {
        @Volatile var instance: SnipService? = null
    }

    private val main = Handler(Looper.getMainLooper())
    private lateinit var wm: WindowManager
    private var bubble: BubbleView? = null
    private lateinit var bubbleLp: WindowManager.LayoutParams
    private var selection: SelectionOverlay? = null
    private var basket: BasketOverlay? = null
    private var busy = false
    private val prefs by lazy { getSharedPreferences("snip", MODE_PRIVATE) }
    private val bubbleSize by lazy { dpi(88) }
    private val fade = Runnable { bubble?.animate()?.alpha(0.6f)?.setDuration(500)?.start() }

    /** true όσο μπροστά είναι το ίδιο το PrismaBoard: εκεί ο κύκλος δεν χρειάζεται. */
    private var inPrisma = false
    private var prismaPkg: String? = null
    private val ignoredPkgs = mutableSetOf("com.android.systemui")

    override fun onServiceConnected() {
        instance = this
        wm = getSystemService(WindowManager::class.java)
        ignoredPkgs += packageName
        getSystemService(android.view.inputmethod.InputMethodManager::class.java)
            ?.enabledInputMethodList?.forEach { ignoredPkgs += it.packageName } // το πληκτρολόγιο δεν αλλάζει την εφαρμογή
        prismaPkg = Prisma.find(this)?.packageName
        showBubble()
        updateBubble()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg in ignoredPkgs) return
        if (prismaPkg == null) prismaPkg = Prisma.find(this)?.packageName
        val cls = event.className?.toString().orEmpty()
        // Η εγκατεστημένη PWA τρέχει μέσα στον Chrome (WebappActivity / WebApkActivity), όχι στο δικό της πακέτο
        inPrisma = pkg == prismaPkg || cls.contains("WebApk", ignoreCase = true) || cls.contains("Webapp", ignoreCase = true)
        updateBubble()
    }

    /** Ο κύκλος φαίνεται όταν το ψαλίδι είναι ανοιχτό από τις Ρυθμίσεις και δεν είμαστε μέσα στο PrismaBoard. */
    fun updateBubble() {
        val v = bubble ?: return
        val show = SnipPrefs.enabled(this) && !inPrisma && selection == null && !busy
        val target = if (show) View.VISIBLE else View.GONE
        if (v.visibility == target) return
        v.visibility = target
        // κρυμμένος κύκλος: το παράθυρό του δεν πρέπει να «τρώει» τα αγγίγματα σε εκείνο το σημείο
        bubbleLp.flags = if (show) bubbleLp.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()
        else bubbleLp.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        runCatching { wm.updateViewLayout(v, bubbleLp) }
        if (show) {
            v.alpha = 1f
            v.pop()
            scheduleFade()
        }
    }
    override fun onInterrupt() {}

    override fun onUnbind(intent: Intent?): Boolean {
        cleanup()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        cleanup()
        super.onDestroy()
    }

    private fun cleanup() {
        instance = null
        selection?.close()
        basket?.close()
        bubble?.let { runCatching { wm.removeView(it) } }
        bubble = null
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (bubble != null) {
            placeBubble(prefs.getBoolean("right", true), prefs.getFloat("y", 0.62f))
            bubble?.let { wm.updateViewLayout(it, bubbleLp) }
        }
    }

    fun screenSize(): Rect = wm.currentWindowMetrics.bounds

    fun overlayParams(w: Int, h: Int) = WindowManager.LayoutParams(
        w, h,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT
    ).apply {
        gravity = Gravity.TOP or Gravity.START
        layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    // ---------- φούσκα ----------

    private fun placeBubble(right: Boolean, yFraction: Float) {
        val s = screenSize()
        val margin = dpi(8)
        bubbleLp.x = if (right) s.width() - bubbleSize - margin else margin
        bubbleLp.y = (yFraction.coerceIn(0f, 1f) * (s.height() - bubbleSize)).toInt()
    }

    fun bubbleCenter(): Point = Point(bubbleLp.x + bubbleSize / 2, bubbleLp.y + bubbleSize / 2)

    @SuppressLint("ClickableViewAccessibility")
    private fun showBubble() {
        val v = BubbleView(this)
        bubbleLp = overlayParams(bubbleSize, bubbleSize)
        placeBubble(prefs.getBoolean("right", true), prefs.getFloat("y", 0.62f))
        v.count = SnipStore.basket(this).size

        var downX = 0f
        var downY = 0f
        var startX = 0
        var startY = 0
        var dragging = false
        var longFired = false
        val slop = ViewConfiguration.get(this).scaledTouchSlop * 2f
        val longPress = Runnable {
            longFired = true
            v.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
            openBasket()
        }

        v.setOnTouchListener { _, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    main.removeCallbacks(fade)
                    v.animate().cancel()
                    v.alpha = 1f
                    downX = e.rawX
                    downY = e.rawY
                    startX = bubbleLp.x
                    startY = bubbleLp.y
                    dragging = false
                    longFired = false
                    main.postDelayed(longPress, 650)
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - downX
                    val dy = e.rawY - downY
                    if (!dragging && hypot(dx, dy) > slop) {
                        dragging = true
                        main.removeCallbacks(longPress)
                    }
                    if (dragging) {
                        bubbleLp.x = startX + dx.toInt()
                        bubbleLp.y = startY + dy.toInt()
                        wm.updateViewLayout(v, bubbleLp)
                    }
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    main.removeCallbacks(longPress)
                    if (dragging) snapBubble()
                    else if (!longFired && e.actionMasked == MotionEvent.ACTION_UP) capture()
                    scheduleFade()
                }
            }
            true
        }
        wm.addView(v, bubbleLp)
        bubble = v
        scheduleFade()
    }

    private fun scheduleFade() {
        main.removeCallbacks(fade)
        main.postDelayed(fade, 3000)
    }

    /** Η φούσκα «κολλάει» στην πιο κοντινή πλαϊνή άκρη. */
    private fun snapBubble() {
        val v = bubble ?: return
        val s = screenSize()
        val right = bubbleLp.x + bubbleSize / 2 > s.width() / 2
        val margin = dpi(8)
        val targetX = if (right) s.width() - bubbleSize - margin else margin
        bubbleLp.y = bubbleLp.y.coerceIn(0, s.height() - bubbleSize)
        prefs.edit()
            .putBoolean("right", right)
            .putFloat("y", bubbleLp.y.toFloat() / (s.height() - bubbleSize).coerceAtLeast(1))
            .apply()
        ValueAnimator.ofInt(bubbleLp.x, targetX).apply {
            duration = 220
            interpolator = DecelerateInterpolator()
            addUpdateListener {
                bubbleLp.x = it.animatedValue as Int
                if (bubble != null) wm.updateViewLayout(v, bubbleLp)
            }
            start()
        }
    }

    fun refreshCount() {
        bubble?.count = SnipStore.basket(this).size
    }

    // ---------- λήψη ----------

    fun capture() {
        if (busy || selection != null) return
        busy = true
        basket?.close()
        updateBubble()
        // λίγος χρόνος ώστε να εξαφανιστεί η φούσκα πριν το στιγμιότυπο
        main.postDelayed({ shoot(retry = true) }, 160)
    }

    private fun shoot(retry: Boolean) {
        takeScreenshot(Display.DEFAULT_DISPLAY, mainExecutor, object : TakeScreenshotCallback {
            override fun onSuccess(result: ScreenshotResult) {
                val hb = result.hardwareBuffer
                val bmp = Bitmap.wrapHardwareBuffer(hb, result.colorSpace)?.let { hw ->
                    hw.copy(Bitmap.Config.ARGB_8888, false).also { hw.recycle() }
                }
                hb.close()
                if (bmp == null) {
                    failed("Δεν πάρθηκε στιγμιότυπο")
                    return
                }
                busy = false
                selection = SelectionOverlay(this@SnipService, bmp).also { it.show() }
            }

            override fun onFailure(errorCode: Int) {
                if (retry && errorCode == AccessibilityService.ERROR_TAKE_SCREENSHOT_INTERVAL_TIME_SHORT) {
                    main.postDelayed({ shoot(retry = false) }, 1000)
                } else {
                    failed("Δεν πάρθηκε στιγμιότυπο (κωδικός $errorCode)")
                }
            }
        })
    }

    private fun failed(msg: String) {
        busy = false
        updateBubble()
        toast(msg)
    }

    fun onSelectionClosed() {
        selection = null
        updateBubble()
    }

    // ---------- ενέργειες ----------

    fun sendToPrisma(crop: Bitmap) = thread {
        val f = SnipStore.tempFile(this, crop)
        crop.recycle()
        main.post {
            val uri = SnipStore.uri(this, f)
            runCatching { SnipStore.copyToClipboard(this, uri) }
            if (!Prisma.send(this, listOf(uri))) {
                toast("Δεν βρέθηκε εγκατεστημένο το PrismaBoard — διάλεξε εφαρμογή. Η εικόνα είναι και στο πρόχειρο.")
            }
        }
    }

    fun sendFiles(files: List<File>) = thread {
        val moved = SnipStore.takeFromBasket(this, files)
        main.post {
            refreshCount()
            if (moved.isNotEmpty() && !Prisma.send(this, moved.map { SnipStore.uri(this, it) })) {
                toast("Δεν βρέθηκε εγκατεστημένο το PrismaBoard — διάλεξε εφαρμογή.")
            }
        }
    }

    fun addToBasket(crop: Bitmap) = thread {
        val n = SnipStore.addToBasket(this, crop)
        crop.recycle()
        main.post {
            bubble?.count = n
            bubble?.pop()
            toast("🧺 Στο καλάθι: $n · κράτα πατημένο τον κύκλο για να τα στείλεις")
        }
    }

    fun copy(crop: Bitmap) = thread {
        val f = SnipStore.tempFile(this, crop)
        crop.recycle()
        main.post {
            val ok = runCatching { SnipStore.copyToClipboard(this, SnipStore.uri(this, f)) }.isSuccess
            toast(if (ok) "📋 Αντιγράφηκε — πάτα Επικόλληση στο PrismaBoard" else "Η αντιγραφή απέτυχε")
        }
    }

    fun save(crop: Bitmap) = thread {
        val ok = SnipStore.saveToGallery(this, crop)
        crop.recycle()
        main.post { toast(if (ok) "💾 Αποθηκεύτηκε στις Εικόνες/PrismaSnip" else "Η αποθήκευση απέτυχε") }
    }

    // ---------- καλάθι ----------

    fun openBasket() {
        if (selection != null || basket != null) return
        basket = BasketOverlay(this).also { it.show() }
    }

    fun onBasketClosed(b: BasketOverlay) {
        if (basket === b) basket = null
    }
}
