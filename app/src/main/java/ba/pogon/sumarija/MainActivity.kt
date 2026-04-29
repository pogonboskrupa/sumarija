package ba.pogon.sumarija

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.hilt.navigation.compose.hiltViewModel
import ba.pogon.sumarija.navigation.NavGraph
import ba.pogon.sumarija.ui.login.LoginViewModel
import ba.pogon.sumarija.ui.theme.SumarijTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val loginViewModel: LoginViewModel = hiltViewModel()
            splashScreen.setKeepOnScreenCondition { loginViewModel.isCheckingAuth }

            SumarijTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    NavGraph(loginViewModel = loginViewModel)
                }
            }
        }
    }
}
