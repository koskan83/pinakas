package gr.grafida.prismasnip

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Αρχεία εικόνων: το «καλάθι» (μένει) και προσωρινά αρχεία για αποστολή (σβήνονται μετά από μία ώρα). */
object SnipStore {
    private const val MAX_BASKET = 20
    private const val TEMP_LIFETIME_MS = 60 * 60 * 1000L

    private fun basketDir(ctx: Context) = File(ctx.filesDir, "basket").apply { mkdirs() }
    private fun tempDir(ctx: Context) = File(ctx.cacheDir, "snips").apply { mkdirs() }

    private fun newName() = "snip_" + SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(Date()) + ".png"

    private fun writePng(dir: File, bmp: Bitmap): File {
        val f = File(dir, newName())
        FileOutputStream(f).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        return f
    }

    fun uri(ctx: Context, f: File): Uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", f)

    fun basket(ctx: Context): List<File> =
        basketDir(ctx).listFiles { f -> f.name.endsWith(".png") }?.sortedBy { it.name } ?: emptyList()

    fun addToBasket(ctx: Context, bmp: Bitmap): Int {
        writePng(basketDir(ctx), bmp)
        val all = basket(ctx)
        if (all.size > MAX_BASKET) all.take(all.size - MAX_BASKET).forEach { it.delete() }
        return minOf(all.size, MAX_BASKET)
    }

    fun clearBasket(ctx: Context) = basket(ctx).forEach { it.delete() }

    /** Βγάζει αρχεία από το καλάθι για αποστολή: μετακινούνται στα προσωρινά, ώστε η εφαρμογή-παραλήπτης να προλάβει να τα διαβάσει. */
    fun takeFromBasket(ctx: Context, files: List<File>): List<File> {
        cleanTemp(ctx)
        return files.mapNotNull { f ->
            val dst = File(tempDir(ctx), f.name)
            if (f.renameTo(dst)) dst else null
        }
    }

    fun tempFile(ctx: Context, bmp: Bitmap): File {
        cleanTemp(ctx)
        return writePng(tempDir(ctx), bmp)
    }

    private fun cleanTemp(ctx: Context) {
        val old = System.currentTimeMillis() - TEMP_LIFETIME_MS
        tempDir(ctx).listFiles()?.filter { it.lastModified() < old }?.forEach { it.delete() }
    }

    fun copyToClipboard(ctx: Context, uri: Uri) {
        val cm = ctx.getSystemService(ClipboardManager::class.java)
        cm.setPrimaryClip(ClipData.newUri(ctx.contentResolver, "PrismaSnip", uri))
    }

    /** Αποθήκευση στη Συλλογή, στον φάκελο Εικόνες/PrismaSnip. */
    fun saveToGallery(ctx: Context, bmp: Bitmap): Boolean {
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, newName())
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/PrismaSnip")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val cr = ctx.contentResolver
        val uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return false
        return try {
            cr.openOutputStream(uri)?.use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) } ?: throw IllegalStateException()
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            cr.update(uri, values, null, null)
            true
        } catch (e: Exception) {
            cr.delete(uri, null, null)
            false
        }
    }
}
