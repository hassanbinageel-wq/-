package com.hsnpmt.sonymonitor.sony

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.io.OutputStream

/**
 * حفظ الملفات المستوردة من الكاميرا في معرض الهاتف (Pictures/SonyMonitor و Movies/SonyMonitor).
 * ننسخ الأصل كما هو بايتًا ببايت — لا إعادة ضغط ولا تعديل — ولا نحذف شيئًا من الكاميرا.
 */
object MediaStoreSaver {

    fun downscaleJpeg(bytes: ByteArray, maxDim: Int): ByteArray {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= maxDim || bounds.outHeight / (sample * 2) >= maxDim) sample *= 2
        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: return bytes
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, 82, out)
        bmp.recycle()
        return out.toByteArray()
    }

    /** مفتاح منع التكرار: الاسم + الحجم. يعيد Uri محفوظًا سابقًا إن وُجد وما زال صالحًا. */
    fun existing(ctx: Context, name: String, size: Long): String? {
        val prefs = ctx.getSharedPreferences("imports", Context.MODE_PRIVATE)
        val uri = prefs.getString("$name|$size", null) ?: return null
        return try {
            ctx.contentResolver.openInputStream(Uri.parse(uri))?.close(); uri
        } catch (_: Exception) {
            if (uri.startsWith("file:") && File(Uri.parse(uri).path ?: "").exists()) uri else null
        }
    }

    private fun remember(ctx: Context, name: String, size: Long, uri: String) {
        ctx.getSharedPreferences("imports", Context.MODE_PRIVATE).edit().putString("$name|$size", uri).apply()
    }

    /**
     * ينسخ input إلى المعرض. onProgress(bytesCopied). يعيد Uri كنص.
     */
    fun save(
        ctx: Context, name: String, mime: String, size: Long, input: InputStream,
        onProgress: (Long) -> Unit
    ): String {
        val isVideo = mime.startsWith("video/")
        val uriStr: String
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val collection = if (isVideo) MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                             else MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                put(MediaStore.MediaColumns.MIME_TYPE, mime)
                put(MediaStore.MediaColumns.RELATIVE_PATH,
                    (if (isVideo) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES) + "/SonyMonitor")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val resolver = ctx.contentResolver
            val uri = resolver.insert(collection, values) ?: throw IllegalStateException("تعذّر إنشاء الملف في المعرض")
            try {
                resolver.openOutputStream(uri)?.use { copy(input, it, onProgress) }
                    ?: throw IllegalStateException("تعذّر فتح الملف للكتابة")
                values.clear(); values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            } catch (e: Exception) {
                runCatching { resolver.delete(uri, null, null) }
                throw e
            }
            uriStr = uri.toString()
        } else {
            // Android 8–9: مجلد التطبيق الخارجي (لا يحتاج إذن تخزين) ثم فهرسة
            val dir = File(ctx.getExternalFilesDir(if (isVideo) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES), "SonyMonitor")
            dir.mkdirs()
            val f = File(dir, name)
            f.outputStream().use { copy(input, it, onProgress) }
            MediaScannerConnection.scanFile(ctx, arrayOf(f.absolutePath), arrayOf(mime), null)
            uriStr = Uri.fromFile(f).toString()
        }
        remember(ctx, name, size, uriStr)
        return uriStr
    }

    private fun copy(input: InputStream, out: OutputStream, onProgress: (Long) -> Unit) {
        val buf = ByteArray(256 * 1024)
        var total = 0L
        var lastReport = 0L
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            out.write(buf, 0, n)
            total += n
            if (total - lastReport > 512 * 1024) { onProgress(total); lastReport = total }
        }
        onProgress(total)
    }
}
