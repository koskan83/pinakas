package gr.grafida.prismasnip

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.RectF
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.view.animation.AccelerateInterpolator
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.io.File
import kotlin.concurrent.thread

/** Η οθόνη επιλογής: παγωμένο στιγμιότυπο, οδηγία κάτω και μπάρα ενεργειών δίπλα στην επιλογή. */
class SelectionOverlay(private val svc: SnipService, private val shot: Bitmap) {
    private val wm = svc.getSystemService(WindowManager::class.java)
    private val root = FrameLayout(svc)
    private val view = SelectionView(svc, shot, svc.screenSize())
    private val hintText = TextView(svc)
    private val hint = LinearLayout(svc)
    private val bar = LinearLayout(svc)
    private var closed = false

    init {
        root.addView(view, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))

        // οδηγία + Άκυρο στο κάτω μέρος, εκεί που φτάνει το χέρι στον πίνακα
        hint.orientation = LinearLayout.HORIZONTAL
        hint.gravity = Gravity.CENTER_VERTICAL
        hint.background = svc.pill(Palette.PANEL, 28f)
        hint.setPadding(svc.dpi(24), svc.dpi(10), svc.dpi(10), svc.dpi(10))
        hintText.setTextColor(Color.WHITE)
        hintText.textSize = 20f
        setHint()
        hint.addView(hintText, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { marginEnd = svc.dpi(20) })
        hint.addView(svc.bigButton("✕  Άκυρο", Palette.RED) { close() })
        root.addView(hint, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply {
            bottomMargin = svc.dpi(40)
        })

        bar.orientation = LinearLayout.HORIZONTAL
        bar.background = svc.pill(0xF2FFFFFF.toInt(), 30f)
        bar.elevation = svc.dp(12f)
        bar.setPadding(svc.dpi(8), svc.dpi(8), svc.dpi(8), svc.dpi(8))
        bar.visibility = View.INVISIBLE
        addAction("➤  PrismaBoard", Palette.BLUE) { svc.sendToPrisma(it) }
        bar.addView(svc.bigButton("🧺  Καλάθι", Palette.ORANGE) { flyToBasket() }, actionLp())
        addAction("📋", Palette.GREEN) { svc.copy(it) }
        addAction("💾", Palette.VIOLET) { svc.save(it) }
        bar.addView(svc.bigButton("✕", Palette.GREY) { close() }, actionLp())
        root.addView(bar, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT))

        view.onTouchStart = {
            bar.visibility = View.INVISIBLE
            hint.visibility = View.INVISIBLE
        }
        view.onChange = { sel ->
            if (sel == null) {
                bar.visibility = View.INVISIBLE
                setHint()
                hint.visibility = View.VISIBLE
            } else {
                placeBar(sel)
            }
        }
    }

    private fun setHint() {
        hintText.text = if (view.waitingSecondCorner) "Τώρα άγγιξε την απέναντι γωνία"
        else "✂  Σύρε πάνω στο κομμάτι — ή άγγιξε δύο γωνίες"
    }

    private fun actionLp() = LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply {
        setMargins(svc.dpi(5), 0, svc.dpi(5), 0)
    }

    private fun addAction(label: String, color: Int, action: (Bitmap) -> Unit) {
        bar.addView(svc.bigButton(label, color) {
            val crop = view.crop() ?: return@bigButton
            close()
            action(crop)
        }, actionLp())
    }

    private fun placeBar(sel: RectF) {
        bar.measure(View.MeasureSpec.UNSPECIFIED, View.MeasureSpec.UNSPECIFIED)
        val w = bar.measuredWidth.toFloat()
        val h = bar.measuredHeight.toFloat()
        val m = svc.dp(16f)
        val rw = root.width.toFloat()
        val rh = root.height.toFloat()
        val x = (sel.centerX() - w / 2).coerceIn(m, maxOf(m, rw - w - m))
        val y = when {
            sel.bottom + m + h < rh - m -> sel.bottom + m
            sel.top - m - h > m -> sel.top - m - h
            else -> sel.bottom - h - m
        }
        bar.translationX = x
        bar.translationY = y
        bar.visibility = View.VISIBLE
        hint.visibility = View.INVISIBLE
    }

    /** Το κομμάτι «πετάει» μέσα στη φούσκα· μετά μπαίνει στο καλάθι. */
    private fun flyToBasket() {
        val sel = view.selection ?: return
        val crop = view.crop() ?: return
        bar.visibility = View.INVISIBLE
        val iv = ImageView(svc).apply {
            setImageBitmap(crop)
            scaleType = ImageView.ScaleType.FIT_XY
            elevation = svc.dp(20f)
            pivotX = 0f
            pivotY = 0f
            translationX = sel.left
            translationY = sel.top
        }
        root.addView(iv, FrameLayout.LayoutParams(sel.width().toInt(), sel.height().toInt()))
        val loc = IntArray(2)
        root.getLocationOnScreen(loc)
        val target = svc.bubbleCenter()
        val sc = svc.dp(40f) / maxOf(sel.width(), sel.height())
        iv.animate()
            .translationX(target.x - loc[0] - sel.width() * sc / 2)
            .translationY(target.y - loc[1] - sel.height() * sc / 2)
            .scaleX(sc).scaleY(sc).alpha(0.5f)
            .setInterpolator(AccelerateInterpolator())
            .setDuration(420)
            .withEndAction {
                close()
                svc.addToBasket(crop)
            }
            .start()
    }

    fun show() {
        root.alpha = 0f
        wm.addView(root, svc.overlayParams(MATCH_PARENT, MATCH_PARENT))
        root.animate().alpha(1f).setDuration(150).start()
    }

    fun close() {
        if (closed) return
        closed = true
        runCatching { wm.removeView(root) }
        shot.recycle()
        svc.onSelectionClosed()
    }
}

/** Το καλάθι: κομμάτια που μάζεψες, για να τα στείλεις ένα-ένα ή όλα μαζί στο PrismaBoard. */
class BasketOverlay(private val svc: SnipService) {
    private val wm = svc.getSystemService(WindowManager::class.java)
    private val root = FrameLayout(svc)
    private var closed = false

    init {
        root.setBackgroundColor(0x99000000.toInt())
        root.setOnClickListener { close() }
        val files = SnipStore.basket(svc)

        val panel = LinearLayout(svc).apply {
            orientation = LinearLayout.VERTICAL
            background = svc.pill(Color.WHITE, 28f)
            setPadding(svc.dpi(24), svc.dpi(20), svc.dpi(24), svc.dpi(20))
            isClickable = true // να μην κλείνει όταν αγγίζεις μέσα στο πάνελ
        }
        panel.addView(TextView(svc).apply {
            text = if (files.isEmpty()) "🧺 Το καλάθι είναι άδειο" else "🧺 Καλάθι · ${files.size} κομμάτια"
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Palette.INK)
        })

        if (files.isEmpty()) {
            panel.addView(TextView(svc).apply {
                text = "Μετά την επιλογή πάτα «🧺 Καλάθι» για να μαζέψεις πολλά κομμάτια\nκαι να τα στείλεις όλα μαζί στο PrismaBoard."
                textSize = 18f
                setTextColor(Palette.MUTED)
                setPadding(0, svc.dpi(10), 0, svc.dpi(10))
            })
        } else {
            val row = LinearLayout(svc).apply { orientation = LinearLayout.HORIZONTAL }
            for (f in files) row.addView(thumb(f))
            panel.addView(HorizontalScrollView(svc).apply {
                addView(row)
                isHorizontalScrollBarEnabled = true
            }, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = svc.dpi(14) })
            panel.addView(TextView(svc).apply {
                text = "Άγγιξε ένα για να σταλεί μόνο αυτό · κράτα πατημένο για διαγραφή"
                textSize = 16f
                setTextColor(Palette.MUTED)
                setPadding(0, svc.dpi(8), 0, 0)
            })
        }

        val buttons = LinearLayout(svc).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER }
        val blp = { LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { setMargins(svc.dpi(6), 0, svc.dpi(6), 0) } }
        if (files.isNotEmpty()) {
            buttons.addView(svc.bigButton("➤  Όλα στο PrismaBoard", Palette.BLUE) { close(); svc.sendFiles(files) }, blp())
            buttons.addView(svc.bigButton("🗑  Άδειασμα", Palette.RED) { SnipStore.clearBasket(svc); close(); svc.refreshCount() }, blp())
        }
        buttons.addView(svc.bigButton("✕  Κλείσιμο", Palette.GREY) { close() }, blp())
        panel.addView(buttons, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = svc.dpi(16) })

        root.addView(panel, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply {
            bottomMargin = svc.dpi(40)
            leftMargin = svc.dpi(16)
            rightMargin = svc.dpi(16)
        })
    }

    private fun thumb(f: File): View {
        val h = svc.dpi(170)
        val iv = ImageView(svc).apply {
            adjustViewBounds = true
            maxHeight = h
            maxWidth = svc.dpi(320)
            minimumWidth = svc.dpi(90)
            minimumHeight = h
            scaleType = ImageView.ScaleType.FIT_CENTER
            background = svc.pill(0xFFF3F4F6.toInt(), 14f)
            setPadding(svc.dpi(6), svc.dpi(6), svc.dpi(6), svc.dpi(6))
            setOnClickListener { close(); svc.sendFiles(listOf(f)) }
            setOnLongClickListener {
                f.delete()
                close()
                svc.refreshCount()
                svc.openBasket()
                true
            }
        }
        thread {
            val bmp = decodeSmall(f, h)
            iv.post { if (bmp != null) iv.setImageBitmap(bmp) }
        }
        return iv.apply {
            layoutParams = LinearLayout.LayoutParams(WRAP_CONTENT, h).apply { marginEnd = svc.dpi(12) }
        }
    }

    private fun decodeSmall(f: File, h: Int): Bitmap? {
        val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(f.path, o)
        var sample = 1
        while (o.outHeight / (sample * 2) >= h) sample *= 2
        return BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample })
    }

    fun show() {
        wm.addView(root, svc.overlayParams(MATCH_PARENT, MATCH_PARENT))
    }

    fun close() {
        if (closed) return
        closed = true
        runCatching { wm.removeView(root) }
        svc.onBasketClosed(this)
    }
}
