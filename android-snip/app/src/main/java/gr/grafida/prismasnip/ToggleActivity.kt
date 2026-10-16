package gr.grafida.prismasnip

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast

/**
 * Ο διακόπτης «Ψαλίδι» στις Ρυθμίσεις του PrismaBoard ανοίγει `prismasnip://on` ή `prismasnip://off`.
 * Δεν δείχνει τίποτα· αλλάζει τη ρύθμιση και επιστρέφει αμέσως στο PrismaBoard.
 */
class ToggleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val on = intent?.data?.host != "off"
        SnipPrefs.setEnabled(this, on)
        val svc = SnipService.instance
        svc?.updateBubble()
        when {
            !on -> toast("Το ψαλίδι του PrismaBoard κρύφτηκε")
            svc == null -> startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            else -> toast("✔ Ο κύκλος του PrismaBoard εμφανίζεται όταν πας σε άλλη σελίδα ή εφαρμογή")
        }
        finish()
    }

    private fun toast(msg: String) = Toast.makeText(applicationContext, msg, Toast.LENGTH_LONG).show()
}

object SnipPrefs {
    private fun prefs(ctx: android.content.Context) = ctx.getSharedPreferences("snip", android.content.Context.MODE_PRIVATE)
    fun enabled(ctx: android.content.Context) = prefs(ctx).getBoolean("enabled", true)
    fun setEnabled(ctx: android.content.Context, on: Boolean) = prefs(ctx).edit().putBoolean("enabled", on).apply()
}
