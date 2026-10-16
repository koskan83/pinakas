package gr.grafida.prismasnip

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PointF
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import kotlin.math.hypot

/**
 * Παγωμένη εικόνα της οθόνης όπου διαλέγεις περιοχή:
 * σύρσιμο, ή άγγιγμα σε δύο απέναντι γωνίες (πιο εύκολο σε μεγάλο πίνακα).
 * Μετά η επιλογή διορθώνεται με τις λαβές στις γωνίες ή μετακινείται σέρνοντας το εσωτερικό της.
 */
@SuppressLint("ViewConstructor")
class SelectionView(ctx: Context, private val shot: Bitmap, private val screen: Rect) : View(ctx) {
    var onChange: ((RectF?) -> Unit)? = null
    var onTouchStart: (() -> Unit)? = null

    var selection: RectF? = null
        private set
    private var corner: PointF? = null
    val waitingSecondCorner get() = corner != null

    private val loc = IntArray(2)
    private val dst = RectF()

    private val bmpPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val dim = Paint().apply { color = Color.argb(150, 0, 0, 0) }
    private val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = ctx.dp(3f); color = Palette.BLUE
    }
    private val handleFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val handleRing = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = ctx.dp(4f); color = Palette.BLUE
    }
    private val markRing = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = ctx.dp(3f); color = Color.WHITE
    }
    private val labelBg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.PANEL }
    private val labelText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE; textSize = ctx.dp(16f); typeface = Typeface.DEFAULT_BOLD
    }

    private val handleR = ctx.dp(16f)
    private val grab = ctx.dp(48f)
    private val minSize = ctx.dp(24f)
    private val slop = ViewConfiguration.get(ctx).scaledTouchSlop.toFloat()

    private enum class Mode { NONE, NEW, MOVE, CORNER }
    private var mode = Mode.NONE
    private val down = PointF()
    private val anchor = PointF()
    private val startSel = RectF()
    private var moved = false

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        // η εικόνα καλύπτει όλη την οθόνη· αν το παράθυρο δεν ξεκινά από το (0,0), μετατοπίζεται ανάλογα
        getLocationOnScreen(loc)
        dst.set(
            (screen.left - loc[0]).toFloat(), (screen.top - loc[1]).toFloat(),
            (screen.right - loc[0]).toFloat(), (screen.bottom - loc[1]).toFloat()
        )
    }

    private fun corners(s: RectF) = listOf(
        PointF(s.left, s.top), PointF(s.right, s.top), PointF(s.right, s.bottom), PointF(s.left, s.bottom)
    )

    private fun rectOf(x1: Float, y1: Float, x2: Float, y2: Float) = RectF(
        minOf(x1, x2).coerceAtLeast(0f), minOf(y1, y2).coerceAtLeast(0f),
        maxOf(x1, x2).coerceAtMost(width.toFloat()), maxOf(y1, y2).coerceAtMost(height.toFloat())
    )

    override fun onDraw(canvas: Canvas) {
        canvas.drawBitmap(shot, null, dst, bmpPaint)
        val w = width.toFloat()
        val h = height.toFloat()
        val s = selection
        if (s == null) {
            canvas.drawRect(0f, 0f, w, h, dim)
            corner?.let { c ->
                canvas.drawCircle(c.x, c.y, context.dp(26f), markRing)
                canvas.drawCircle(c.x, c.y, context.dp(26f) - context.dp(4f), border)
                canvas.drawCircle(c.x, c.y, context.dp(5f), handleFill)
            }
            return
        }
        canvas.save()
        canvas.clipOutRect(s)
        canvas.drawRect(0f, 0f, w, h, dim)
        canvas.restore()
        canvas.drawRect(s, border)
        for (p in corners(s)) {
            canvas.drawCircle(p.x, p.y, handleR, handleFill)
            canvas.drawCircle(p.x, p.y, handleR, handleRing)
        }
        val px = pixelRect(s)
        val label = "${px.width()} × ${px.height()}"
        val tw = labelText.measureText(label)
        val pad = context.dp(8f)
        val lh = labelText.textSize + pad * 2
        var ly = s.top - lh - context.dp(10f)
        if (ly < 0f) ly = s.top + context.dp(10f)
        val lx = (s.left + handleR + pad).coerceAtMost(w - tw - pad * 2)
        canvas.drawRoundRect(lx, ly, lx + tw + pad * 2, ly + lh, lh / 2, lh / 2, labelBg)
        canvas.drawText(label, lx + pad, ly + pad - labelText.ascent() - context.dp(2f), labelText)
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        val x = e.x
        val y = e.y
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                onTouchStart?.invoke()
                down.set(x, y)
                moved = false
                val s = selection
                val ci = if (s != null) corners(s).indexOfFirst { hypot(it.x - x, it.y - y) < grab } else -1
                mode = when {
                    s != null && ci >= 0 -> {
                        val opp = corners(s)[(ci + 2) % 4]
                        anchor.set(opp.x, opp.y)
                        Mode.CORNER
                    }
                    s != null && s.contains(x, y) -> {
                        startSel.set(s)
                        Mode.MOVE
                    }
                    else -> Mode.NEW
                }
            }
            MotionEvent.ACTION_MOVE -> {
                if (!moved && hypot(x - down.x, y - down.y) > slop) moved = true
                if (!moved) return true
                when (mode) {
                    Mode.NEW -> {
                        corner = null
                        selection = rectOf(down.x, down.y, x, y)
                    }
                    Mode.CORNER -> selection = rectOf(anchor.x, anchor.y, x, y)
                    Mode.MOVE -> {
                        val dx = (x - down.x).coerceIn(-startSel.left, width - startSel.right)
                        val dy = (y - down.y).coerceIn(-startSel.top, height - startSel.bottom)
                        selection = RectF(startSel).apply { offset(dx, dy) }
                    }
                    Mode.NONE -> {}
                }
                invalidate()
            }
            MotionEvent.ACTION_UP -> {
                if (mode == Mode.NEW && !moved) {
                    val c = corner
                    if (c == null) {
                        corner = PointF(x, y)
                        selection = null
                    } else {
                        selection = rectOf(c.x, c.y, x, y)
                        corner = null
                    }
                }
                selection?.let { if (it.width() < minSize || it.height() < minSize) selection = null }
                mode = Mode.NONE
                invalidate()
                onChange?.invoke(selection)
            }
            MotionEvent.ACTION_CANCEL -> {
                mode = Mode.NONE
                invalidate()
                onChange?.invoke(selection)
            }
        }
        return true
    }

    /** Η επιλογή σε pixels της πραγματικής εικόνας (όχι της προβολής). */
    private fun pixelRect(s: RectF): Rect {
        val sx = shot.width / dst.width()
        val sy = shot.height / dst.height()
        val l = ((s.left - dst.left) * sx).toInt().coerceIn(0, shot.width - 1)
        val t = ((s.top - dst.top) * sy).toInt().coerceIn(0, shot.height - 1)
        val r = ((s.right - dst.left) * sx).toInt().coerceIn(l + 1, shot.width)
        val b = ((s.bottom - dst.top) * sy).toInt().coerceIn(t + 1, shot.height)
        return Rect(l, t, r, b)
    }

    fun crop(): Bitmap? {
        val s = selection ?: return null
        val p = pixelRect(s)
        val c = Bitmap.createBitmap(shot, p.left, p.top, p.width(), p.height())
        // όταν η επιλογή είναι όλη η εικόνα, το createBitmap επιστρέφει το ίδιο αντικείμενο
        return if (c === shot) shot.copy(Bitmap.Config.ARGB_8888, false) else c
    }
}
