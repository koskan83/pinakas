package gr.grafida.prismasnip

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Οδηγός ρύθμισης: ενεργοποίηση της υπηρεσίας και σύνδεση με το PrismaBoard. */
class MainActivity : Activity() {
    private lateinit var serviceStatus: TextView
    private lateinit var prismaStatus: TextView
    private lateinit var basketStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpi(24), dpi(32), dpi(24), dpi(40))
        }
        col.addView(TextView(this).apply {
            text = "Ψαλίδι PrismaBoard"
            textSize = 36f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Palette.INK)
        })
        col.addView(text(
            "Ένας κύκλος με το σήμα του PrismaBoard εμφανίζεται πάνω από τις άλλες σελίδες και εφαρμογές. " +
                "Τον πατάς, κόβεις ένα κομμάτι από PDF, σελίδα ή βιβλίο, και μπαίνει στο μάθημα. Θέλει μία ρύθμιση, μόνο την πρώτη φορά.",
            19f, Palette.MUTED
        ))

        card(col, "Ενεργοποίηση (μία φορά)") { c ->
            serviceStatus = status()
            c.addView(serviceStatus)
            c.addView(text(
                "Προσβασιμότητα → «PrismaBoard ψαλίδι» → Ενεργοποίηση.\n" +
                    "Αν ο διακόπτης είναι γκρι: «Ρυθμίσεις εφαρμογής» → ⋮ πάνω δεξιά → «Να επιτρέπονται οι περιορισμένες ρυθμίσεις», και ξανά από την αρχή.\n" +
                    "Το ψαλίδι δεν διαβάζει και δεν στέλνει πουθενά αλλού ό,τι εμφανίζεται στην οθόνη."
            ))
            c.addView(row(
                bigButton("Άνοιγμα Προσβασιμότητας", Palette.BLUE) {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                },
                bigButton("Ρυθμίσεις εφαρμογής", Palette.GREY) {
                    startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
                }
            ))
            c.addView(row(bigButton("✔  Πίσω στο PrismaBoard", Palette.GREEN) { backToPrisma() }))
        }

        card(col, "Σύνδεση με το PrismaBoard") { c ->
            prismaStatus = status()
            c.addView(prismaStatus)
            c.addView(text("Άνοιξε το PrismaBoard στον Chrome και πάτα ⋮ → «Εγκατάσταση εφαρμογής». Μετά το ψαλίδι στέλνει κατευθείαν εκεί, στο μάθημα που είναι ανοιχτό."))
            c.addView(row(bigButton("Άνοιγμα PrismaBoard", Palette.VIOLET) {
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Prisma.URL))) }
            }))
        }

        card(col, "Πώς δουλεύει") { c ->
            c.addView(text(
                "①  Σε άλλη σελίδα ή εφαρμογή, πάτα τον κύκλο του PrismaBoard στην άκρη της οθόνης.\n" +
                    "②  Σύρε πάνω στο κομμάτι — ή άγγιξε δύο απέναντι γωνίες.\n" +
                    "③  Πάτα «➤ PrismaBoard».\n\n" +
                    "🧺  «Καλάθι»: μάζεψε πολλά κομμάτια και στείλ' τα όλα μαζί (κράτα πατημένο τον κύκλο).\n" +
                    "📋  Αντιγραφή στο πρόχειρο · 💾 Αποθήκευση στις Εικόνες/PrismaSnip.\n" +
                    "↕  Σύρε τον κύκλο όπου σε βολεύει — κολλάει στην πιο κοντινή άκρη.\n" +
                    "⚙  Ανοίγει και κλείνει από το PrismaBoard: ☰ → Ρυθμίσεις και αρχεία → «Ψαλίδι πάνω από άλλες εφαρμογές».",
                19f, Palette.INK
            ))
        }

        card(col, "Καλάθι") { c ->
            basketStatus = status()
            c.addView(basketStatus)
            c.addView(row(bigButton("🗑  Άδειασμα", Palette.RED) {
                SnipStore.clearBasket(this)
                SnipService.instance?.refreshCount()
                refresh()
            }))
        }

        // σε μεγάλη οθόνη το περιεχόμενο μένει σε στήλη που διαβάζεται άνετα
        val frame = FrameLayout(this)
        frame.addView(col, FrameLayout.LayoutParams(
            minOf(resources.displayMetrics.widthPixels, dpi(860)), WRAP_CONTENT, Gravity.CENTER_HORIZONTAL
        ))
        setContentView(ScrollView(this).apply { addView(frame) })
    }

    private fun backToPrisma() {
        val pkg = Prisma.find(this)?.packageName
        val launch = pkg?.let { packageManager.getLaunchIntentForPackage(it) }
        runCatching { startActivity(launch ?: Intent(Intent.ACTION_VIEW, Uri.parse(Prisma.URL))) }
        finish()
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun refresh() {
        val on = SnipService.instance != null || serviceEnabled()
        serviceStatus.text = if (on) "✔ Ενεργό — το ψαλίδι φαίνεται στην άκρη της οθόνης" else "✗ Δεν έχει ενεργοποιηθεί"
        serviceStatus.setTextColor(if (on) Palette.GREEN else Palette.RED)

        val found = Prisma.find(this) != null
        prismaStatus.text = if (found) "✔ Βρέθηκε το PrismaBoard" else "✗ Το PrismaBoard δεν είναι εγκατεστημένο ως εφαρμογή"
        prismaStatus.setTextColor(if (found) Palette.GREEN else Palette.RED)

        val n = SnipStore.basket(this).size
        basketStatus.text = if (n == 0) "Άδειο" else "$n κομμάτια περιμένουν"
        basketStatus.setTextColor(Palette.INK)
    }

    private fun serviceEnabled(): Boolean {
        val list = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        return list.split(':').any { it.startsWith("$packageName/", ignoreCase = true) }
    }

    private fun text(t: String, size: Float = 17f, color: Int = Palette.MUTED) = TextView(this).apply {
        text = t
        textSize = size
        setTextColor(color)
        setLineSpacing(0f, 1.2f)
        setPadding(0, dpi(8), 0, dpi(8))
    }

    private fun status() = TextView(this).apply {
        textSize = 20f
        typeface = Typeface.DEFAULT_BOLD
        setPadding(0, dpi(6), 0, dpi(4))
    }

    private fun row(vararg views: TextView) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(0, dpi(8), 0, 0)
        for (v in views) addView(v, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { marginEnd = dpi(12) })
    }

    private fun card(parent: LinearLayout, title: String, fill: (LinearLayout) -> Unit) {
        val c = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = pill(Color.WHITE, 22f)
            elevation = dp(2f)
            setPadding(dpi(24), dpi(20), dpi(24), dpi(20))
        }
        c.addView(TextView(this).apply {
            text = title
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Palette.INK)
        })
        fill(c)
        parent.addView(c, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dpi(20) })
    }
}
