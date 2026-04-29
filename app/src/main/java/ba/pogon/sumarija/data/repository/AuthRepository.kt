package ba.pogon.sumarija.data.repository

import ba.pogon.sumarija.data.local.PrefsManager
import ba.pogon.sumarija.data.model.User
import com.google.gson.Gson
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class MobileKorisnik(
    val id: String = "",
    val username: String = "",
    @SerialName("password_hash") val passwordHash: String = "",
    @SerialName("full_name") val fullName: String = "",
    @SerialName("user_type") val userType: String = "",
    val active: Boolean = true
)

sealed class AuthResult {
    data class Success(val user: User) : AuthResult()
    data class Error(val message: String) : AuthResult()
}

@Singleton
class AuthRepository @Inject constructor(
    private val prefs: PrefsManager,
    private val supabase: SupabaseClient
) {
    private val gson = Gson()

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    suspend fun login(username: String, password: String): AuthResult =
        withContext(Dispatchers.IO) {
            try {
                val hash = sha256(password)
                val result = supabase.postgrest["mobile_korisnici"]
                    .select(Columns.ALL) {
                        filter {
                            eq("username", username.trim().lowercase())
                            eq("password_hash", hash)
                            eq("active", true)
                        }
                    }
                    .decodeSingleOrNull<MobileKorisnik>()

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

            // Provjeri da korisnik još uvijek postoji i aktivan
            try {
                val hash = sha256(password)
                val result = supabase.postgrest["mobile_korisnici"]
                    .select(Columns.ALL) {
                        filter {
                            eq("username", user.username.lowercase())
                            eq("password_hash", hash)
                            eq("active", true)
                        }
                    }
                    .decodeSingleOrNull<MobileKorisnik>()

                if (result == null) {
                    prefs.clearAuth()
                    return@withContext null
                }
                AuthResult.Success(user.copy(password = password))
            } catch (e: Exception) {
                // Offline — vrati keširanog korisnika
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
