package ba.pogon.sumarija.data.repository

import ba.pogon.sumarija.BuildConfig
import ba.pogon.sumarija.data.api.ApiClient
import ba.pogon.sumarija.data.local.PrefsManager
import ba.pogon.sumarija.data.model.*
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DataRepository @Inject constructor(
    private val prefs: PrefsManager
) {
    private val gson = Gson()
    private val apiUrl = BuildConfig.API_URL

    private fun buildParams(
        path: String,
        username: String,
        password: String,
        extra: Map<String, Any?> = emptyMap()
    ): Map<String, String> {
        val params = mutableMapOf(
            "path" to path,
            "username" to username,
            "password" to password
        )
        extra.forEach { (k, v) -> if (v != null) params[k] = v.toString() }
        return params
    }

    private suspend fun fetch(params: Map<String, String>, cacheKey: String? = null, maxAgeMs: Long = 3 * 60 * 60 * 1000L): JsonObject? =
        withContext(Dispatchers.IO) {
            // Try cache first
            if (cacheKey != null) {
                val cached = prefs.getCache(cacheKey, maxAgeMs)
                if (cached != null) {
                    return@withContext gson.fromJson(cached, JsonObject::class.java)
                }
            }
            // Network call
            val response = ApiClient.apiService.call(apiUrl, params)
            val body = response.body() ?: return@withContext null
            // Save to cache
            if (cacheKey != null) {
                prefs.putCache(cacheKey, body.toString())
            }
            body
        }

    // ── Dashboard ────────────────────────────────────────────────────────────

    suspend fun loadDashboard(user: User, year: Int): DashboardData =
        withContext(Dispatchers.IO) {
            try {
                val params = buildParams("dashboard", user.username, user.password, mapOf("year" to year))
                val json = fetch(params, "dashboard_${year}") ?: return@withContext DashboardData(error = "Nema odgovora")
                gson.fromJson(json, DashboardData::class.java)
            } catch (e: Exception) {
                DashboardData(error = e.message)
            }
        }

    // ── Primaci ──────────────────────────────────────────────────────────────

    suspend fun loadPrimaci(user: User, year: Int): PrimaciResponse =
        withContext(Dispatchers.IO) {
            try {
                val params = buildParams("primaci", user.username, user.password, mapOf("year" to year))
                val json = fetch(params, "primaci_$year") ?: return@withContext PrimaciResponse(error = "Nema odgovora")
                gson.fromJson(json, PrimaciResponse::class.java)
            } catch (e: Exception) {
                PrimaciResponse(error = e.message)
            }
        }

    suspend fun loadPrimaciDaily(user: User, year: Int, month: Int): DailyResponse =
        withContext(Dispatchers.IO) {
            try {
                val params = buildParams("primaci-daily", user.username, user.password, mapOf("year" to year, "month" to month))
                val json = fetch(params, "primaci_daily_${year}_$month") ?: return@withContext DailyResponse(error = "Nema odgovora")
                gson.fromJson(json, DailyResponse::class.java)
            } catch (e: Exception) {
                DailyResponse(error = e.message)
            }
        }

    // ── Otpremaci ────────────────────────────────────────────────────────────

    suspend fun loadOtpremaci(user: User, year: Int): OtpremaciResponse =
        withContext(Dispatchers.IO) {
            try {
                val params = buildParams("otpremaci", user.username, user.password, mapOf("year" to year))
                val json = fetch(params, "otpremaci_$year") ?: return@withContext OtpremaciResponse(error = "Nema odgovora")
                gson.fromJson(json, OtpremaciResponse::class.java)
            } catch (e: Exception) {
                OtpremaciResponse(error = e.message)
            }
        }

    suspend fun loadOtpremaciDaily(user: User, year: Int, month: Int): DailyResponse =
        withContext(Dispatchers.IO) {
            try {
                val params = buildParams("otpremaci-daily", user.username, user.password, mapOf("year" to year, "month" to month))
                val json = fetch(params, "otpremaci_daily_${year}_$month") ?: return@withContext DailyResponse(error = "Nema odgovora")
                gson.fromJson(json, DailyResponse::class.java)
            } catch (e: Exception) {
                DailyResponse(error = e.message)
            }
        }

    // ── Stanje Zaliha ────────────────────────────────────────────────────────

    suspend fun loadStanjeZaliha(user: User, poslovodja: String? = null): StanjeZalihaResponse =
        withContext(Dispatchers.IO) {
            try {
                val extra = if (poslovodja != null) mapOf("poslovodja" to poslovodja) else emptyMap()
                val params = buildParams("stanje-zaliha", user.username, user.password, extra)
                val cacheKey = "stanje_zaliha${if (poslovodja != null) "_${poslovodja.replace(" ", "_")}" else ""}"
                val json = fetch(params, cacheKey) ?: return@withContext StanjeZalihaResponse(error = "Nema odgovora")
                gson.fromJson(json, StanjeZalihaResponse::class.java)
            } catch (e: Exception) {
                StanjeZalihaResponse(error = e.message)
            }
        }

    // ── Kupci ────────────────────────────────────────────────────────────────

    suspend fun loadKupci(user: User, year: Int): KupciResponse =
        withContext(Dispatchers.IO) {
            try {
                val params = buildParams("kupci", user.username, user.password, mapOf("year" to year))
                val json = fetch(params, "kupci_$year") ?: return@withContext KupciResponse(error = "Nema odgovora")
                gson.fromJson(json, KupciResponse::class.java)
            } catch (e: Exception) {
                KupciResponse(error = e.message)
            }
        }

    // ── Primke (poslovodja/sihtarica) ────────────────────────────────────────

    suspend fun loadPrimke(user: User): PrimkeResponse =
        withContext(Dispatchers.IO) {
            try {
                val params = buildParams("primke", user.username, user.password)
                val json = fetch(params, "primke", maxAgeMs = 30 * 60 * 1000L)
                    ?: return@withContext PrimkeResponse(error = "Nema odgovora")
                gson.fromJson(json, PrimkeResponse::class.java)
            } catch (e: Exception) {
                PrimkeResponse(error = e.message)
            }
        }

    suspend fun loadOtpreme(user: User): OtpremeResponse =
        withContext(Dispatchers.IO) {
            try {
                val params = buildParams("otpreme", user.username, user.password)
                val json = fetch(params, "otpreme", maxAgeMs = 30 * 60 * 1000L)
                    ?: return@withContext OtpremeResponse(error = "Nema odgovora")
                gson.fromJson(json, OtpremeResponse::class.java)
            } catch (e: Exception) {
                OtpremeResponse(error = e.message)
            }
        }

    // ── Personal (primac/otpremac vlastiti podaci) ───────────────────────────

    suspend fun loadPersonal(user: User, year: Int): PersonalResponse =
        withContext(Dispatchers.IO) {
            try {
                val path = if (user.userType == ba.pogon.sumarija.data.model.UserType.PRIMAC)
                    "primac-personal" else "otpremac-personal"
                val params = buildParams(path, user.username, user.password, mapOf("year" to year))
                val json = fetch(params, "${path}_$year")
                    ?: return@withContext PersonalResponse(error = "Nema odgovora")
                gson.fromJson(json, PersonalResponse::class.java)
            } catch (e: Exception) {
                PersonalResponse(error = e.message)
            }
        }

    // ── Poslovodja radilista ──────────────────────────────────────────────────

    suspend fun loadPoslovodjaRadilista(user: User): List<String> =
        withContext(Dispatchers.IO) {
            try {
                val params = buildParams("poslovodja-radilista", user.username, user.password,
                    mapOf("poslovodja" to user.fullName))
                val json = fetch(params, "poslovodja_radilista_${user.username}", maxAgeMs = 24 * 60 * 60 * 1000L)
                    ?: return@withContext emptyList()
                val resp = gson.fromJson(json, PoslovodjaRadilistaResponse::class.java)
                resp.radilista
            } catch (e: Exception) {
                emptyList()
            }
        }

    suspend fun clearCache() = prefs.clearCache()
}
