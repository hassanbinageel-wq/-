package com.hsnpmt.salahalarm

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.hsnpmt.salahalarm.databinding.ActivityCameraBinding
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Live camera with on-device ML Kit image labeling. When it sees a sink/faucet
 * (any DETECT_KEYWORDS label above CONFIDENCE) it returns RESULT_OK (dismiss mode)
 * or shows a success state (preview mode).
 */
class CameraActivity : AppCompatActivity() {

    private lateinit var b: ActivityCameraBinding
    private lateinit var cameraExecutor: ExecutorService
    private var mode: String = Const.MODE_PREVIEW
    @Volatile private var handled = false

    private val labeler by lazy {
        val options = ImageLabelerOptions.Builder()
            .setConfidenceThreshold(Const.CONFIDENCE)
            .build()
        ImageLabeling.getClient(options)
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startCamera()
        else {
            Toast.makeText(this, "نحتاج إذن الكاميرا لإيقاف المنبّه", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityCameraBinding.inflate(layoutInflater)
        setContentView(b.root)

        mode = intent.getStringExtra(Const.EXTRA_MODE) ?: Const.MODE_PREVIEW
        cameraExecutor = Executors.newSingleThreadExecutor()

        b.btnClose.setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }
        b.btnDone.setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = future.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(b.previewView.surfaceProvider)
            }

            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also { it.setAnalyzer(cameraExecutor) { proxy -> analyze(proxy) } }

            try {
                provider.unbindAll()
                provider.bindToLifecycle(
                    this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis
                )
            } catch (e: Exception) {
                Log.e("CameraActivity", "bind failed", e)
                Toast.makeText(this, "تعذّر تشغيل الكاميرا", Toast.LENGTH_LONG).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @ExperimentalGetImage
    private fun analyze(proxy: ImageProxy) {
        if (handled) { proxy.close(); return }
        val media = proxy.image
        if (media == null) { proxy.close(); return }

        val input = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)
        labeler.process(input)
            .addOnSuccessListener { labels ->
                var matchedText: String? = null
                var topLabel: String? = null
                for (l in labels) {
                    if (topLabel == null) topLabel = l.text
                    val t = l.text.lowercase()
                    if (Const.DETECT_KEYWORDS.any { t.contains(it) }) {
                        matchedText = l.text
                        break
                    }
                }

                runOnUiThread {
                    if (matchedText != null) {
                        onDetected(matchedText!!)
                    } else if (!handled && topLabel != null) {
                        b.tvStatus.text = "جارٍ البحث... (أرى: $topLabel)"
                    }
                }
            }
            .addOnCompleteListener { proxy.close() }
    }

    private fun onDetected(label: String) {
        if (handled) return
        handled = true

        if (mode == Const.MODE_DISMISS) {
            setResult(RESULT_OK)
            finish()
        } else {
            b.tvStatus.text = "✓ تم التعرّف على: $label"
            b.btnDone.visibility = android.view.View.VISIBLE
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::cameraExecutor.isInitialized) cameraExecutor.shutdown()
        try { labeler.close() } catch (_: Exception) { }
    }
}
