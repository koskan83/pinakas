package gr.grafida.prismasnip

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.util.TypedValue
import android.view.Gravity
import android.widget.TextView

object Palette {
    const val INK = 0xFF1F2937.toInt()
    const val MUTED = 0xFF6B7280.toInt()
    const val BLUE = 0xFF2563EB.toInt()
    const val VIOLET = 0xFF7C3AED.toInt()
    const val GREEN = 0xFF16A34A.toInt()
    const val ORANGE = 0xFFF97316.toInt()
    const val RED = 0xFFDC2626.toInt()
    const val GREY = 0xFF4B5563.toInt()
    const val PANEL = 0xE6111827.toInt()
}

fun Context.dp(v: Float): Float = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)
fun Context.dpi(v: Int): Int = dp(v.toFloat()).toInt()

fun Context.pill(color: Int, radiusDp: Float = 18f): GradientDrawable =
    GradientDrawable().apply { setColor(color); cornerRadius = dp(radiusDp) }

/** Μεγάλο κουμπί για αφή/γραφίδα (τουλάχιστον 64dp ύψος). */
fun Context.bigButton(label: String, color: Int, onClick: () -> Unit): TextView = TextView(this).apply {
    text = label
    setTextColor(Color.WHITE)
    textSize = 20f
    typeface = Typeface.DEFAULT_BOLD
    gravity = Gravity.CENTER
    background = RippleDrawable(ColorStateList.valueOf(0x40FFFFFF), pill(color), null)
    setPadding(dpi(22), dpi(14), dpi(22), dpi(14))
    minHeight = dpi(64)
    minWidth = dpi(64)
    isClickable = true
    setOnClickListener { onClick() }
}
