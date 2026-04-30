package ba.pogon.sumarija.data.repository

import ba.pogon.sumarija.data.local.PrefsManager
import ba.pogon.sumarija.data.model.User
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
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
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    companion object {
        const val GAS_URL = "https://script.google.com/macros/s/" +
            "AKfycbz__4umdSqKd0o81TnDgdtHufd0FcaT-1E2oLq9pcHqfWPjVgIA9WZDz6-O4ta_fiUR/exec"
    }

    suspend fun login(username: String, password: String): AuthResult =
        withContext(Dispatchers.IO) {
            try {
                val url = "$GAS_URL?path=login" +
                    "&username=${URLEncoder.encode(username.trim(), "UTF-8")}" +
                    "&password=${URLEncoder.encode(password, "UTF-8")}"

                val request = Request.Builder().url(url).get().build()
                client.newCall(request).execute().use { response ->
                    val body = response.body?.string()
                        ?: return@withContext AuthResult.Error("Nema odgovora od servera")

                    val json = gson.fromJson(body, JsonObject::class.java)
                    val success = json.get("success")?.asBoolean ?: false

                    if (!success) {
                        val error = json.get("error")?.asString
                            ?: "Pogrešno korisničko ime ili lozinka"
                        return@withContext AuthResult.Error(error)
                    }

                    val user = User(
                        username = json.get("username")?.asString ?: username.trim(),
                        fullName = json.get("fullName")?.asString ?: username.trim(),
                        type = json.get("type")?.asString ?: "",
                        role = json.get("role")?.asString ?: "",
                        password = password
                    )
                    prefs.saveCredentials(username.trim(), password)
                    prefs.saveUserJson(body)
                    AuthResult.Success(user)
                }
            } catch (e: Exception) {
                AuthResult.Error("Greška: ${e.message}")
            }
        }

    suspend fun autoLogin(): AuthResult? = withContext(Dispatchers.IO) {
        try {
            val userJson = prefs.userJsonFlow.firstOrNull() ?: return@withContext null
            val password = prefs.getPassword() ?: return@withContext null
            val json = gson.fromJson(userJson, JsonObject::class.java)
            val username = json.get("username")?.asString ?: return@withContext null
            val user = User(
                username = username,
                fullName = json.get("fullName")?.asString ?: username,
                type = json.get("type")?.asString ?: "",
                role = json.get("role")?.asString ?: "",
                password = password
            )
            AuthResult.Success(user)
        } catch (e: Exception) {
            null
        }
    }

    suspend fun getSavedCredentials(): Pair<String, String>? {
        val json = prefs.userJsonFlow.firstOrNull() ?: return null
        val pass = prefs.getPassword() ?: return null
        return Pair(json, pass)
    }

    suspend fun logout() {
        prefs.clearAuth()
    }
}
