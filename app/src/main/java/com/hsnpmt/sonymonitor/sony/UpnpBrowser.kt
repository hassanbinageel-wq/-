package com.hsnpmt.sonymonitor.sony

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.w3c.dom.Element
import org.w3c.dom.Node
import java.io.ByteArrayInputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.SocketTimeoutException
import java.net.URL
import javax.xml.parsers.DocumentBuilderFactory

/**
 * استعراض ملفات بطاقة الكاميرا عبر UPnP ContentDirectory (خادم وسائط DLNA).
 *
 * كاميرات Sony (ومنها a7 III) لا تكشف ملفات البطاقة أثناء وضع «التحكّم بالهاتف»؛
 * بل عبر وضع «إرسال إلى الهاتف الذكي» (Send to Smartphone) حيث تعمل كخادم DLNA.
 * لذلك هذه الوحدة: تكتشف خدمة ContentDirectory بـ SSDP، ثم تستعرضها بـ SOAP Browse.
 * لا شيء هنا يُعدّل ملفات الكاميرا — قراءة فقط.
 */
object UpnpBrowser {
    private const val TAG = "UpnpBrowser"
    private const val CD = "urn:schemas-upnp-org:service:ContentDirectory:1"

    data class Server(val controlUrl: String, val friendlyName: String, val location: String)

    data class Item(
        val id: String,
        val title: String,
        val kind: String,        // photo / video / other
        val date: String,
        val mime: String,
        val url: String,
        val thumbUrl: String?,
        val size: Long
    )

    /** يبحث عن خادم ContentDirectory. يعيد null إن لم يُعثر عليه. */
    fun discover(http: OkHttpClient, timeoutMs: Int = 4000): Server? {
        val sts = listOf(CD, "urn:schemas-upnp-org:device:MediaServer:1")
        val locations = LinkedHashSet<String>()
        var socket: DatagramSocket? = null
        try {
            socket = DatagramSocket().apply { reuseAddress = true; broadcast = true; soTimeout = 700 }
            val group = InetSocketAddress(InetAddress.getByName("239.255.255.250"), 1900)
            val deadline = System.currentTimeMillis() + timeoutMs
            var lastSend = 0L
            val buf = ByteArray(2048)
            while (System.currentTimeMillis() < deadline) {
                if (System.currentTimeMillis() - lastSend > 900) {
                    for (st in sts) {
                        val req = "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 1\r\nST: $st\r\n\r\n".toByteArray()
                        try { socket.send(DatagramPacket(req, req.size, group)) } catch (_: Exception) {}
                    }
                    lastSend = System.currentTimeMillis()
                }
                try {
                    val p = DatagramPacket(buf, buf.size)
                    socket.receive(p)
                    val text = String(p.data, 0, p.length, Charsets.UTF_8)
                    text.split("\r\n").firstOrNull { it.startsWith("LOCATION:", true) }
                        ?.substringAfter(':')?.trim()?.let { loc ->
                            if (locations.add(loc)) {
                                parseServer(http, loc)?.let { return it }
                            }
                        }
                } catch (_: SocketTimeoutException) {}
            }
        } catch (e: Exception) {
            Log.w(TAG, "discover: ${e.message}")
        } finally { socket?.close() }

        // احتياطي: عناوين وصف شائعة لخادم الوسائط في كاميرات Sony
        for (loc in listOf(
            "http://192.168.122.1:64321/DmsDescPush.xml",
            "http://192.168.122.1:64321/DmsRmtDesc.xml",
            "http://192.168.122.1:64321/DmsDesc.xml"
        )) {
            if (loc in locations) continue
            parseServer(http, loc)?.let { return it }
        }
        return null
    }

    private fun parseServer(http: OkHttpClient, location: String): Server? = try {
        val xml = http.newCall(Request.Builder().url(location).get().build()).execute().use { r ->
            if (!r.isSuccessful) null else r.body?.bytes()
        } ?: throw IllegalStateException("لا وصف")
        val doc = docOf(xml)
        var control: String? = null
        for (svc in byLocal(doc.documentElement, "service")) {
            val type = childText(svc, "serviceType") ?: continue
            if (type.contains("ContentDirectory", true)) { control = childText(svc, "controlURL"); break }
        }
        if (control == null) null else {
            val base = byLocal(doc.documentElement, "URLBase").firstOrNull()?.textContent?.trim()
                ?.takeIf { it.isNotEmpty() } ?: location
            Server(URL(URL(base), control).toString(),
                byLocal(doc.documentElement, "friendlyName").firstOrNull()?.textContent?.trim() ?: "Camera", location)
        }
    } catch (e: Exception) {
        Log.w(TAG, "parseServer $location: ${e.message}"); null
    }

    /** يستعرض الشجرة كاملة (بحدود) ويعيد العناصر من صور وفيديو. */
    fun listAll(http: OkHttpClient, server: Server, maxItems: Int = 800): List<Item> {
        val out = ArrayList<Item>()
        val queue = ArrayDeque<Pair<String, Int>>()
        queue.add("0" to 0)
        val seen = HashSet<String>()
        while (queue.isNotEmpty() && out.size < maxItems) {
            val (id, depth) = queue.removeFirst()
            if (!seen.add(id)) continue
            var start = 0
            while (out.size < maxItems) {
                val page = browse(http, server, id, start, 100)
                page.containers.forEach { if (depth < 6) queue.add(it to depth + 1) }
                out.addAll(page.items)
                start += page.returned
                if (page.returned == 0 || start >= page.total) break
            }
        }
        return out
    }

    private class Page(val items: List<Item>, val containers: List<String>, val returned: Int, val total: Int)

    private fun browse(http: OkHttpClient, server: Server, objectId: String, start: Int, count: Int): Page {
        val body = """<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:Browse xmlns:u="$CD"><ObjectID>${esc(objectId)}</ObjectID><BrowseFlag>BrowseDirectChildren</BrowseFlag><Filter>*</Filter><StartingIndex>$start</StartingIndex><RequestedCount>$count</RequestedCount><SortCriteria></SortCriteria></u:Browse></s:Body></s:Envelope>"""
        val req = Request.Builder().url(server.controlUrl)
            .header("SOAPACTION", "\"$CD#Browse\"")
            .post(body.toRequestBody("text/xml; charset=\"utf-8\"".toMediaType()))
            .build()
        val xml = http.newCall(req).execute().use { r ->
            val b = r.body?.bytes() ?: ByteArray(0)
            if (!r.isSuccessful) throw IllegalStateException("Browse HTTP ${r.code}")
            b
        }
        val env = docOf(xml).documentElement
        val didl = byLocal(env, "Result").firstOrNull()?.textContent ?: ""
        val returned = byLocal(env, "NumberReturned").firstOrNull()?.textContent?.trim()?.toIntOrNull() ?: 0
        val total = byLocal(env, "TotalMatches").firstOrNull()?.textContent?.trim()?.toIntOrNull() ?: 0
        if (didl.isBlank()) return Page(emptyList(), emptyList(), returned, total)

        val root = docOf(didl.toByteArray(Charsets.UTF_8)).documentElement
        val containers = byLocal(root, "container").mapNotNull { (it as Element).getAttribute("id").takeIf { s -> s.isNotEmpty() } }
        val items = byLocal(root, "item").mapNotNull { parseItem(it as Element) }
        return Page(items, containers, returned, total)
    }

    private fun parseItem(e: Element): Item? {
        val id = e.getAttribute("id")
        val title = childText(e, "title") ?: id
        val cls = childText(e, "class") ?: ""
        val date = childText(e, "date") ?: ""
        var orig: Triple<String, String, Long>? = null
        var thumb: String? = null
        var thumbRank = 99
        var origLrg = false
        for (r in byLocal(e, "res")) {
            val re = r as Element
            val url = re.textContent?.trim().orEmpty()
            if (url.isEmpty()) continue
            val pi = re.getAttribute("protocolInfo")
            val mime = pi.split(':').getOrNull(2).orEmpty()
            val size = re.getAttribute("size").toLongOrNull() ?: 0L
            val isThumb = pi.contains("JPEG_TN") || pi.contains("JPEG_SM")
            if (isThumb || (cls.contains("video") && mime.startsWith("image/"))) {
                val rank = if (pi.contains("JPEG_TN")) 0 else if (pi.contains("JPEG_SM")) 1 else 2
                if (rank < thumbRank) { thumb = url; thumbRank = rank }
                continue
            }
            // الأصل: نفضّل JPEG_LRG صراحةً، وإلا الأكبر حجمًا
            val lrg = pi.contains("JPEG_LRG")
            val better = orig == null || (lrg && !origLrg) || (lrg == origLrg && size > orig.third)
            if (better) { orig = Triple(url, mime, size); origLrg = lrg }
        }
        if (thumb == null) thumb = childText(e, "albumArtURI")
        val o = orig ?: return null
        val kind = when {
            cls.contains("imageItem") || o.second.startsWith("image/") -> "photo"
            cls.contains("videoItem") || o.second.startsWith("video/") -> "video"
            else -> "other"
        }
        return Item(id, title, kind, date, o.second, o.first, thumb, o.third)
    }

    // ---- أدوات XML (مطابقة بالاسم المحلي مستقلّة عن البادئة) ----
    private fun docOf(xml: ByteArray) =
        DocumentBuilderFactory.newInstance().apply { isNamespaceAware = false }
            .newDocumentBuilder().parse(ByteArrayInputStream(xml))

    private fun local(n: String) = n.substringAfter(':')

    private fun byLocal(root: Element, name: String): List<Node> {
        val all = root.getElementsByTagName("*")
        val out = ArrayList<Node>()
        for (i in 0 until all.length) if (local(all.item(i).nodeName) == name) out.add(all.item(i))
        return out
    }

    private fun childText(e: Node, name: String): String? {
        val kids = e.childNodes
        for (i in 0 until kids.length) {
            val k = kids.item(i)
            if (local(k.nodeName) == name) return k.textContent?.trim()
        }
        return null
    }

    private fun esc(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
}
