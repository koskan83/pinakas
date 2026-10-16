package gr.grafida.prismasnip

import android.content.ClipData
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri

/** Η εγκατεστημένη εφαρμογή PrismaBoard (PWA από τον Chrome) δέχεται εικόνες με «Κοινοποίηση» (share_target στο manifest της). */
object Prisma {
    const val URL = "https://koskan83.github.io/prismaboard/"

    fun find(ctx: Context): ComponentName? {
        val pm = ctx.packageManager
        val list = pm.queryIntentActivities(Intent(Intent.ACTION_SEND).setType("image/png"), 0)
        val hit = list.firstOrNull { ri ->
            ri.loadLabel(pm).toString().contains("PrismaBoard", ignoreCase = true) ||
                ri.activityInfo.applicationInfo.loadLabel(pm).toString().contains("PrismaBoard", ignoreCase = true)
        } ?: return null
        return ComponentName(hit.activityInfo.packageName, hit.activityInfo.name)
    }

    /** Στέλνει τις εικόνες στο PrismaBoard· αν δεν βρεθεί, ανοίγει την επιλογή εφαρμογής. Επιστρέφει true αν πήγαν κατευθείαν. */
    fun send(ctx: Context, uris: List<Uri>): Boolean {
        if (uris.isEmpty()) return false
        val intent = if (uris.size == 1) {
            Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
        } else {
            Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
        }
        intent.type = "image/png"
        intent.clipData = ClipData.newUri(ctx.contentResolver, "PrismaSnip", uris[0]).also { clip ->
            uris.drop(1).forEach { clip.addItem(ClipData.Item(it)) }
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)

        val target = find(ctx)
        return try {
            if (target != null) {
                ctx.startActivity(intent.setComponent(target))
                true
            } else {
                ctx.startActivity(Intent.createChooser(intent, "Αποστολή σε…").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                false
            }
        } catch (e: Exception) {
            false
        }
    }
}
