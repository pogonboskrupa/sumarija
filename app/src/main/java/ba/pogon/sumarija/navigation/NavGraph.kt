package ba.pogon.sumarija.navigation

import androidx.compose.runtime.*
import androidx.compose.runtime.collectAsState
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import ba.pogon.sumarija.ui.login.LoginScreen
import ba.pogon.sumarija.ui.login.LoginViewModel
import ba.pogon.sumarija.ui.main.MainScreen

object Routes {
    const val LOGIN = "login"
    const val MAIN = "main"
}

@Composable
fun NavGraph(loginViewModel: LoginViewModel) {
    val navController = rememberNavController()
    val uiState by loginViewModel.uiState.collectAsState()

    // Determine start destination based on saved auth
    val startDest = if (uiState.loggedInUser != null) Routes.MAIN else Routes.LOGIN

    NavHost(navController = navController, startDestination = startDest) {
        composable(Routes.LOGIN) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Routes.MAIN) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                viewModel = loginViewModel
            )
        }
        composable(Routes.MAIN) {
            val user = uiState.loggedInUser
            if (user != null) {
                MainScreen(
                    user = user,
                    onLogout = {
                        loginViewModel.logout()
                        navController.navigate(Routes.LOGIN) {
                            popUpTo(Routes.MAIN) { inclusive = true }
                        }
                    }
                )
            }
        }
    }
}
