package ba.pogon.sumarija.ui.login

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ba.pogon.sumarija.data.model.User
import ba.pogon.sumarija.data.repository.AuthRepository
import ba.pogon.sumarija.data.repository.AuthResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val loggedInUser: User? = null
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepo: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    var isCheckingAuth by mutableStateOf(true)
        private set

    init {
        checkSavedAuth()
    }

    private fun checkSavedAuth() {
        viewModelScope.launch {
            try {
                val result = authRepo.autoLogin()
                if (result is AuthResult.Success) {
                    _uiState.value = LoginUiState(loggedInUser = result.user)
                }
            } catch (e: Exception) {
                // No saved auth
            } finally {
                isCheckingAuth = false
            }
        }
    }

    fun login(username: String, password: String) {
        if (username.isBlank() || password.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Unesite korisničko ime i lozinku")
            return
        }
        viewModelScope.launch {
            _uiState.value = LoginUiState(isLoading = true)
            when (val result = authRepo.login(username.trim(), password)) {
                is AuthResult.Success -> {
                    _uiState.value = LoginUiState(loggedInUser = result.user)
                }
                is AuthResult.Error -> {
                    _uiState.value = LoginUiState(error = result.message)
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepo.logout()
            _uiState.value = LoginUiState()
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
