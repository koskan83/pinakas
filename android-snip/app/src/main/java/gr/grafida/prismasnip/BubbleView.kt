package gr.grafida.prismasnip

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.view.View
import android.view.animation.OvershootInterpolator

/** Ο στρογγυλός κύκλος με το σήμα του PrismaBoard και μετρητή για το καλάθι. */
class BubbleView(ctx: Context) : View(ctx) {
    var count = 0
        set(v) { field = v; invalidate() }

    private val logo = ctx.getDrawable(R.drawable.prisma_logo)!!.mutate()
    private val circle = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x40000000 }
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = ctx.dp(3f); color = 0xFF6D5A9C.toInt()
    }
    private val badge = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.ORANGE }
    private val badgeText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE; textSize = ctx.dp(14f); typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.CENTER
    }

    init {
        contentDescription = "PrismaBoard: κόψε ένα κομμάτι της οθόνης"
    }

    override fun onDraw(canvas: Canvas) {
        val pad = context.dp(10f)
        val cx = width / 2f
        val cy = height / 2f
        val r = minOf(width, height) / 2f - pad
        canvas.drawCircle(cx, cy + context.dp(2.5f), r, shadow)
        canvas.drawCircle(cx, cy, r, circle)
        canvas.drawCircle(cx, cy, r - ring.strokeWidth / 2, ring)

        val half = (r * 0.68f).toInt()
        logo.setBounds((cx - half).toInt(), (cy - half).toInt(), (cx + half).toInt(), (cy + half).toInt())
        logo.draw(canvas)

        if (count > 0) {
            val br = context.dp(13f)
            val bx = cx + r * 0.72f
            val by = cy - r * 0.72f
            canvas.drawCircle(bx, by, br, badge)
            val t = if (count > 9) "9+" else count.toString()
            canvas.drawText(t, bx, by - (badgeText.descent() + badgeText.ascent()) / 2f, badgeText)
        }
    }

    /** Μικρό «χοροπήδημα» όταν εμφανίζεται ή όταν κάτι μπαίνει στο καλάθι. */
    fun pop() {
        scaleX = 0.7f
        scaleY = 0.7f
        animate().scaleX(1f).scaleY(1f).setInterpolator(OvershootInterpolator(3f)).setDuration(350).start()
    }
}
