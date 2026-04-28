package ba.pogon.sumarija.data.repository

import ba.pogon.sumarija.BuildConfig
import ba.pogon.sumarija.data.api.ApiClient
import ba.pogon.sumarija.data.local.PrefsManager
import ba.pogon.sumarija.data.model.LoginResponse
import ba.pogon.sumarija.data.model.User
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

sealed class AuthResult {
    data class Success(val user: User) : AuthResult()
    data class Error(val message: String) : AuthResult()
}

@Singleton
class AuthRepository @Inject constructor(
    private val prefs: PrefsManager
) {
    private val gson = Gson()
    private val apiUrl = BuildConfig.API_URL

    suspend fun login(username: String, password: String): AuthResult =
        withContext(Dispatchers.IO) {
            try {
                val params = mapOf(
                    "path" to "login",
                    "username" to username,
                    "password" to password
                )
                val response = ApiClient.apiService.call(apiUrl, params)
                if (!response.isSuccessful) {
                    return@withContext AuthResult.Error("HTTP ${response.code()}")
                }
                val body = response.body()
                    ?: return@withContext AuthResult.Error("Prazan odgovor sa servera")

                val loginResp = gson.fromJson(body, LoginResponse::class.java)
                if (!loginResp.success) {
                    return@withContext AuthResult.Error(loginResp.error ?: "Pogrešno korisničko ime ili lozinka")
                }

                val user = User(
                    username = loginResp.username,
                    fullName = loginResp.fullName,
                    type = loginResp.type,
                    role = loginResp.role,
                    password = password
                )
                prefs.saveCredentials(username, password)
                prefs.saveUserJson(gson.toJson(user))
                AuthResult.Success(user)
            } catch (e: Exception) {
                AuthResult.Error("Greška u komunikaciji: ${e.message}")
            }
        }

    suspend fun autoLogin(): AuthResult? = withContext(Dispatchers.IO) {
        try {
            val userJson = prefs.userJsonFlow.firstOrNull() ?: return@withContext null
            val password = prefs.getPassword() ?: return@withContext null
            val user = gson.fromJson(userJson, User::class.java) ?: return@withContext null

            // Re-validate with server (fallback to cached if network fails)
            try {
                val params = mapOf(
                    "path" to "login",
                    "username" to user.username,
                    "password" to password
                )
                val response = ApiClient.apiService.call(apiUrl, params)
                val body = response.body() ?: return@withContext AuthResult.Success(user.copy(password = password))
                val loginResp = gson.fromJson(body, LoginResponse::class.java)
                if (loginResp.success) {
                    AuthResult.Success(user.copy(password = password))
                } else {
                    prefs.clearAuth()
                    null
                }
            } catch (e: Exception) {
                // Network unavailable — return cached user
                AuthResult.Success(user.copy(password = password))
            }
        } catch (e: Exception) {
            null
        }
    }

    suspend fun logout() {
        prefs.clearAuth()
    }
}

