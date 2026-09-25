package com.hsnpmt.sonymonitor.sony.ptp

import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

/**
 * نقل PTP/IP (ISO 15740 عبر TCP، المنفذ 15740) — البروتوكول الذي تستخدمه كاميرات Sony الأحدث
 * في وضع «التحكّم عن بُعد بالكمبيوتر» (PC Remote) عبر Wi‑Fi.
 *
 * قناتان: قناة أوامر (Command/Data) وقناة أحداث (Event). كل الأعداد Little‑Endian.
 * أنواع الحِزم: 1 InitCommandRequest، 2 InitCommandAck، 3 InitEventRequest، 4 InitEventAck،
 * 5 InitFail، 6 OperationRequest، 7 OperationResponse، 8 Event، 9 StartData، 10 Data،
 * 12 EndData، 13 ProbeRequest، 14 ProbeResponse.
 */
class PtpIpTransport(private val host: String, private val port: Int = 15740) : Closeable {

    class InitFailed(val reason: Int) : Exception("PTP/IP InitFail (reason=0x${reason.toString(16)})")
    class Response(val code: Int, val params: IntArray, val data: ByteArray)

    private var cmd: Socket? = null
    private var evt: Socket? = null
    private lateinit var cin: InputStream
    private lateinit var cout: OutputStream
    private var tid = 0
    var connectionNumber = 0; private set
    var remoteName = ""; private set

    fun open(clientName: String = "SonyMonitor") {
        val guid = uuidBytes(UUID.nameUUIDFromBytes(clientName.toByteArray()))
        val c = Socket().apply { tcpNoDelay = true; soTimeout = 8000 }
        c.connect(InetSocketAddress(host, port), 3000)
        cmd = c; cin = c.getInputStream(); cout = c.getOutputStream()

        val name = (clientName + "\u0000").toByteArray(Charsets.UTF_16LE)
        val init = le(16 + name.size + 4).put(guid).put(name).putInt(0x00010000)
        sendPacket(cout, 1, init.array())
        val (type, payload) = readPacket(cin)
        if (type == 5) throw InitFailed(if (payload.size >= 4) le(payload).int else -1)
        if (type != 2) throw IllegalStateException("رد غير متوقع على InitCommand: $type")
        val bb = le(payload)
        connectionNumber = bb.int
        bb.position(bb.position() + 16)
        remoteName = readUtf16z(bb)

        val e = Socket().apply { tcpNoDelay = true; soTimeout = 0 }
        e.connect(InetSocketAddress(host, port), 3000)
        evt = e
        sendPacket(e.getOutputStream(), 3, le(4).putInt(connectionNumber).array())
        val (etype, epay) = readPacket(e.getInputStream())
        if (etype == 5) throw InitFailed(if (epay.size >= 4) le(epay).int else -1)
        if (etype != 4) throw IllegalStateException("رد غير متوقع على InitEvent: $etype")
    }

    /** قراءة الأحداث في خيط منفصل (تُستدعى حتى الإغلاق). */
    fun readEvent(): Pair<Int, IntArray>? {
        val s = evt ?: return null
        while (true) {
            val (type, p) = readPacket(s.getInputStream())
            if (type == 13) { sendPacket(s.getOutputStream(), 14, ByteArray(0)); continue }
            if (type != 8) continue
            val bb = le(p)
            val code = bb.short.toInt() and 0xFFFF
            bb.int // transaction id
            val params = IntArray(bb.remaining() / 4) { bb.int }
            return code to params
        }
    }

    /** تنفيذ عملية PTP كاملة (طلب ← بيانات اختيارية ← رد). متزامن: عملية واحدة في كل مرة. */
    @Synchronized
    fun transaction(op: Int, params: IntArray = IntArray(0), dataOut: ByteArray? = null): Response {
        val t = ++tid
        val req = le(4 + 2 + 4 + 4 * params.size)
            .putInt(if (dataOut != null) 2 else 1)
            .putShort(op.toShort())
            .putInt(t)
        params.forEach { req.putInt(it) }
        sendPacket(cout, 6, req.array())
        if (dataOut != null) {
            sendPacket(cout, 9, le(12).putInt(t).putLong(dataOut.size.toLong()).array())
            sendPacket(cout, 12, le(4 + dataOut.size).putInt(t).put(dataOut).array())
        }
        val data = ByteArrayOutputStream()
        while (true) {
            val (type, p) = readPacket(cin)
            when (type) {
                9 -> {} // StartData — الطول الكلي (نجمع حتى EndData)
                10, 12 -> data.write(p, 4, p.size - 4)
                7 -> {
                    val bb = le(p)
                    val code = bb.short.toInt() and 0xFFFF
                    bb.int
                    val rp = IntArray(bb.remaining() / 4) { bb.int }
                    return Response(code, rp, data.toByteArray())
                }
                13 -> sendPacket(cout, 14, ByteArray(0))
                else -> {}
            }
        }
    }

    override fun close() {
        try { cmd?.close() } catch (_: Exception) {}
        try { evt?.close() } catch (_: Exception) {}
        cmd = null; evt = null
    }

    // ---- أدوات ----
    private fun sendPacket(out: OutputStream, type: Int, payload: ByteArray) {
        val b = le(8 + payload.size).putInt(8 + payload.size).putInt(type).put(payload)
        synchronized(out) { out.write(b.array()); out.flush() }
    }

    private fun readPacket(input: InputStream): Pair<Int, ByteArray> {
        val h = readFully(input, 8)
        val bb = le(h)
        val len = bb.int
        val type = bb.int
        if (len < 8 || len > 64 * 1024 * 1024) throw IllegalStateException("طول حزمة غير صالح: $len")
        return type to readFully(input, len - 8)
    }

    private fun readFully(input: InputStream, n: Int): ByteArray {
        val b = ByteArray(n)
        var off = 0
        while (off < n) {
            val r = input.read(b, off, n - off)
            if (r < 0) throw java.io.EOFException("انقطع اتصال PTP/IP")
            off += r
        }
        return b
    }

    companion object {
        fun le(n: Int): ByteBuffer = ByteBuffer.allocate(n).order(ByteOrder.LITTLE_ENDIAN)
        fun le(b: ByteArray): ByteBuffer = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN)

        fun readUtf16z(bb: ByteBuffer): String {
            val sb = StringBuilder()
            while (bb.remaining() >= 2) {
                val c = bb.short.toInt().toChar()
                if (c == '\u0000') break
                sb.append(c)
            }
            return sb.toString()
        }

        private fun uuidBytes(u: UUID): ByteArray =
            ByteBuffer.allocate(16).putLong(u.mostSignificantBits).putLong(u.leastSignificantBits).array()
    }
}
