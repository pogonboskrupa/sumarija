package ba.pogon.sumarija

import android.annotation.SuppressLint
import android.net.http.SslError
import android.os.Bundle
import android.webkit.SslErrorHandler
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.hilt.navigation.compose.hiltViewModel
import ba.pogon.sumarija.ui.login.LoginScreen
import ba.pogon.sumarija.ui.login.LoginViewModel
import ba.pogon.sumarija.ui.theme.SumarijTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private var webView: WebView? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val wv = webView
                if (wv != null && wv.canGoBack()) {
                    wv.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        setContent {
            val loginViewModel: LoginViewModel = hiltViewModel()
            splashScreen.setKeepOnScreenCondition { loginViewModel.isCheckingAuth }

            val uiState by loginViewModel.uiState.collectAsState()

            SumarijTheme {
                if (uiState.loggedInUser != null) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { context ->
                            WebView(context).also { wv ->
                                webView = wv
                                wv.settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    databaseEnabled = true
                                    loadWithOverviewMode = true
                                    useWideViewPort = true
                                    setSupportZoom(true)
                                    builtInZoomControls = true
                                    displayZoomControls = false
                                    cacheMode = WebSettings.LOAD_DEFAULT
                                    mediaPlaybackRequiresUserGesture = false
                                }
                                wv.webViewClient = object : WebViewClient() {
                                    override fun shouldOverrideUrlLoading(
                                        view: WebView,
                                        request: WebResourceRequest
                                    ): Boolean = false

                                    override fun onReceivedSslError(
                                        view: WebView,
                                        handler: SslErrorHandler,
                                        error: SslError
                                    ) {
                                        handler.proceed()
                                    }
                                }
                                wv.loadUrl("https://sumarijaboskrupa.work")
                            }
                        }
                    )
                } else {
                    Surface(modifier = Modifier.fillMaxSize()) {
                        LoginScreen(
                            onLoginSuccess = {},
                            viewModel = loginViewModel
                        )
                    }
                }
            }
        }
    }
}
