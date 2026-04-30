package ba.pogon.sumarija.data.repository

import ba.pogon.sumarija.BuildConfig
import ba.pogon.sumarija.data.local.PrefsManager
import ba.pogon.sumarija.data.model.User
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

data class MobileKorisnik(
    val id: String = "",
    val username: String = "",
    @SerializedName("password_hash") val passwordHash: String = "",
    @SerializedName("full_name") val fullName: String = "",
    @SerializedName("user_type") val userType: String = "",
    val active: Boolean = true
)

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
        .build()

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun queryKorisnik(username: String, hash: String): MobileKorisnik? {
        val url = "${BuildConfig.SUPABASE_URL}/rest/v1/mobile_korisnici" +
            "?select=*" +
            "&username=eq.$username" +
            "&password_hash=eq.$hash" +
            "&active=eq.true"

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .addHeader("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
            .addHeader("Accept", "application/json")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            val body = response.body?.string() ?: ""
            if (!response.isSuccessful) {
                throw Exception("Server greška ${response.code}: $body")
            }
            val list = gson.fromJson(body, Array<MobileKorisnik>::class.java)
            return list.firstOrNull()
        }
    }

    suspend fun login(username: String, password: String): AuthResult =
        withContext(Dispatchers.IO) {
            try {
                val hash = sha256(password)
                val result = queryKorisnik(username.trim(), hash)

                if (result == null) {
                    return@withContext AuthResult.Error("Pogrešno korisničko ime ili lozinka")
                }

                val user = User(
                    username = result.username,
                    fullName = result.fullName,
                    type = result.userType,
                    role = if (result.userType == "admin") "admin" else "user",
                    password = password
                )
                prefs.saveCredentials(username.trim(), password)
                prefs.saveUserJson(gson.toJson(user))
                AuthResult.Success(user)
            } catch (e: Exception) {
                AuthResult.Error("Greška: ${e.message}")
            }
        }

    suspend fun autoLogin(): AuthResult? = withContext(Dispatchers.IO) {
        try {
            val userJson = prefs.userJsonFlow.firstOrNull() ?: return@withContext null
            val password = prefs.getPassword() ?: return@withContext null
            val user = gson.fromJson(userJson, User::class.java) ?: return@withContext null
            try {
                val hash = sha256(password)
                val result = queryKorisnik(user.username, hash)
                if (result == null) {
                    prefs.clearAuth()
                    return@withContext null
                }
                AuthResult.Success(user.copy(password = password))
            } catch (e: Exception) {
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
