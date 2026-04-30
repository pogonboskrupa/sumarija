package ba.pogon.sumarija

import android.annotation.SuppressLint
import android.net.http.SslError
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.hilt.navigation.compose.hiltViewModel
import ba.pogon.sumarija.ui.login.LoginScreen
import ba.pogon.sumarija.ui.login.LoginViewModel
import ba.pogon.sumarija.ui.theme.SumarijTheme
import dagger.hilt.android.AndroidEntryPoint
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private var webView: WebView? = null
    private var menuVisible by mutableStateOf(false)

    inner class AndroidBridge {
        @JavascriptInterface
        fun showNativeMenu() {
            runOnUiThread { menuVisible = true }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (menuVisible) {
                    menuVisible = false
                    return
                }
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
                    val user = uiState.loggedInUser!!
                    val userJsonForJs = JSONObject().apply {
                        put("success", true)
                        put("username", user.username)
                        put("fullName", user.fullName)
                        put("type", user.type)
                        put("role", user.role)
                    }.toString()
                    val passwordForJs = JSONObject.quote(user.password)

                    AndroidView(
                        modifier = Modifier
                            .fillMaxSize()
                            .statusBarsPadding()
                            .navigationBarsPadding(),
                        factory = { context ->
                            WebView(context).also { wv ->
                                webView = wv
                                wv.settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    databaseEnabled = true
                                    loadWithOverviewMode = false
                                    useWideViewPort = true
                                    setSupportZoom(true)
                                    builtInZoomControls = true
                                    displayZoomControls = false
                                    cacheMode = WebSettings.LOAD_DEFAULT
                                    mediaPlaybackRequiresUserGesture = false
                                }
                                wv.setInitialScale(50)
                                wv.addJavascriptInterface(AndroidBridge(), "Android")
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

                                    override fun onPageFinished(view: WebView, url: String) {
                                        view.evaluateJavascript("""
                                            (function() {
                                                if (!localStorage.getItem('sumarija_user') || !localStorage.getItem('sumarija_pass')) {
                                                    localStorage.setItem('sumarija_user', JSON.stringify($userJsonForJs));
                                                    localStorage.setItem('sumarija_pass', $passwordForJs);
                                                    location.reload();
                                                }
                                                window.toggleUserMenu = function(e) {
                                                    if (e) e.stopPropagation();
                                                    if (typeof Android !== 'undefined') Android.showNativeMenu();
                                                };
                                            })();
                                        """.trimIndent(), null)
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

                if (menuVisible) {
                    ModalBottomSheet(
                        onDismissRequest = { menuVisible = false },
                        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
                        containerColor = Color(0xFF1E3A5F),
                    ) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = "Meni",
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp)
                            )
                            HorizontalDivider(color = Color.White.copy(alpha = 0.3f))
                            Text(
                                text = "Učitaj prikaze",
                                color = Color.White,
                                fontSize = 16.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        menuVisible = false
                                        webView?.evaluateJavascript("preloadAllViews(false, true)", null)
                                    }
                                    .padding(horizontal = 24.dp, vertical = 18.dp)
                            )
                            HorizontalDivider(color = Color.White.copy(alpha = 0.15f))
                            Text(
                                text = "Obriši keš",
                                color = Color.White,
                                fontSize = 16.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        menuVisible = false
                                        webView?.evaluateJavascript(
                                            "if(typeof _doClearAllCache==='function') _doClearAllCache(); else if(typeof clearAllCache==='function') clearAllCache();",
                                            null
                                        )
                                    }
                                    .padding(horizontal = 24.dp, vertical = 18.dp)
                            )
                            HorizontalDivider(color = Color.White.copy(alpha = 0.15f))
                            Text(
                                text = "Odjava",
                                color = Color(0xFFFF6B6B),
                                fontSize = 16.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        menuVisible = false
                                        webView?.evaluateJavascript(
                                            "if(typeof logout==='function') logout()",
                                            null
                                        )
                                        loginViewModel.logout()
                                    }
                                    .padding(horizontal = 24.dp, vertical = 18.dp)
                            )
                            HorizontalDivider(color = Color.White.copy(alpha = 0.3f))
                        }
                    }
                }
            }
        }
    }
}
