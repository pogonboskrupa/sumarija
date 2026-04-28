package ba.pogon.sumarija.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "sumarija_prefs")

@Singleton
class PrefsManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private object Keys {
        val USERNAME = stringPreferencesKey("username")
        val PASSWORD = stringPreferencesKey("password")
        val USER_JSON = stringPreferencesKey("user_json")
        fun cache(key: String) = stringPreferencesKey("cache_$key")
        fun cacheTs(key: String) = stringPreferencesKey("cache_ts_$key")
    }

    val userJsonFlow: Flow<String?> = context.dataStore.data.map { it[Keys.USER_JSON] }

    suspend fun saveCredentials(username: String, password: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.USERNAME] = username
            prefs[Keys.PASSWORD] = password
        }
    }

    suspend fun saveUserJson(json: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.USER_JSON] = json
        }
    }

    suspend fun getPassword(): String? =
        context.dataStore.data.map { it[Keys.PASSWORD] }.firstOrNull()

    suspend fun clearAuth() {
        context.dataStore.edit { prefs ->
            prefs.remove(Keys.USERNAME)
            prefs.remove(Keys.PASSWORD)
            prefs.remove(Keys.USER_JSON)
        }
    }

    // ── Cache ────────────────────────────────────────────────────────────────

    suspend fun putCache(key: String, json: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.cache(key)] = json
            prefs[Keys.cacheTs(key)] = System.currentTimeMillis().toString()
        }
    }

    suspend fun getCache(key: String, maxAgeMs: Long = 3 * 60 * 60 * 1000L): String? {
        val prefs = context.dataStore.data.firstOrNull() ?: return null
        val value = prefs[Keys.cache(key)] ?: return null
        val ts = prefs[Keys.cacheTs(key)]?.toLongOrNull() ?: return null
        if (System.currentTimeMillis() - ts > maxAgeMs) return null
        return value
    }

    suspend fun clearCache() {
        context.dataStore.edit { prefs ->
            val toRemove = prefs.asMap().keys.filter { it.name.startsWith("cache_") }
            toRemove.forEach { prefs.remove(it) }
        }
    }
}
