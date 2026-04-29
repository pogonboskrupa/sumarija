package ba.pogon.sumarija.data.model

import com.google.gson.annotations.SerializedName

// ─── Auth ───────────────────────────────────────────────────────────────────

data class LoginResponse(
    val success: Boolean = false,
    val username: String = "",
    @SerializedName("fullName") val fullName: String = "",
    val type: String = "",
    val role: String = "",
    val error: String? = null
)

data class User(
    val username: String,
    val fullName: String,
    val type: String,    // primac | otpremac | poslovodja | poslovođa | operativa | admin
    val role: String,
    val password: String = ""
) {
    val userType: UserType get() = when (type.lowercase()) {
        "primac" -> UserType.PRIMAC
        "otpremac" -> UserType.OTPREMAC
        "poslovodja", "poslovođa" -> UserType.POSLOVODJA
        "operativa" -> UserType.OPERATIVA
        else -> UserType.ADMIN
    }
}

enum class UserType { ADMIN, PRIMAC, OTPREMAC, POSLOVODJA, OPERATIVA }

// ─── Dashboard ──────────────────────────────────────────────────────────────

data class DashboardData(
    val odjeli: List<OdjelDashboard> = emptyList(),
    val ukupno: DashboardUkupno? = null,
    val currentMonth: Int = 0,
    val currentYear: Int = 0,
    val error: String? = null
)

data class OdjelDashboard(
    val odjel: String = "",
    val radiliste: String = "",
    val sjecaMjesec: Double = 0.0,
    val sjecaGodina: Double = 0.0,
    val otpremaMjesec: Double = 0.0,
    val otpremaGodina: Double = 0.0,
    val zalihe: Double = 0.0,
    @SerializedName("planMjesec") val planMjesec: Double = 0.0,
    @SerializedName("planGodina") val planGodina: Double = 0.0
)

data class DashboardUkupno(
    val sjecaMjesec: Double = 0.0,
    val sjecaGodina: Double = 0.0,
    val otpremaMjesec: Double = 0.0,
    val otpremaGodina: Double = 0.0,
    val zalihe: Double = 0.0
)

// ─── Primaci / Otpremaci ────────────────────────────────────────────────────

data class PrimaciResponse(
    val primaci: List<PrimacRow> = emptyList(),
    val ukupno: Map<String, Double> = emptyMap(),
    val sortimentiNazivi: List<String> = emptyList(),
    val error: String? = null
)

data class PrimacRow(
    val primac: String = "",
    val radiliste: String = "",
    val odjel: String = "",
    val izvodjac: String = "",
    val sortimenti: Map<String, Double> = emptyMap(),
    val ukupno: Double = 0.0
)

data class OtpremaciResponse(
    val otpremaci: List<OtpremacRow> = emptyList(),
    val ukupno: Map<String, Double> = emptyMap(),
    val sortimentiNazivi: List<String> = emptyList(),
    val error: String? = null
)

data class OtpremacRow(
    val otpremac: String = "",
    val radiliste: String = "",
    val odjel: String = "",
    val kupac: String = "",
    val sortimenti: Map<String, Double> = emptyMap(),
    val ukupno: Double = 0.0
)

// ─── Daily (za izvještaje) ──────────────────────────────────────────────────

data class DailyResponse(
    val data: List<DailyRow> = emptyList(),
    val sortimentiNazivi: List<String> = emptyList(),
    val error: String? = null
)

data class DailyRow(
    val datum: String = "",
    val odjel: String = "",
    val radiliste: String = "",
    val primac: String = "",
    val otpremac: String = "",
    val izvodjac: String = "",
    val sortimenti: Map<String, Double> = emptyMap()
)

// ─── Stanje Zaliha ──────────────────────────────────────────────────────────

data class StanjeZalihaResponse(
    val odjeli: List<OdjelZaliha> = emptyList(),
    val error: String? = null
)

data class OdjelZaliha(
    val odjel: String = "",
    val radiliste: String = "",
    val sjecaUkupno: Double = 0.0,
    val otpremaUkupno: Double = 0.0,
    val zalihe: Double = 0.0,
    val sortimenti: Map<String, Double> = emptyMap()
)

// ─── Kupci ──────────────────────────────────────────────────────────────────

data class KupciResponse(
    val kupci: List<KupacRow> = emptyList(),
    val sortimentiNazivi: List<String> = emptyList(),
    val error: String? = null
)

data class KupacRow(
    val kupac: String = "",
    val sortimenti: Map<String, Double> = emptyMap(),
    val ukupno: Double = 0.0
)

// ─── Poslovodja ─────────────────────────────────────────────────────────────

data class PrimkeResponse(
    val primke: List<PrimkaUnos> = emptyList(),
    val error: String? = null
)

data class PrimkaUnos(
    val id: String = "",
    val datum: String = "",
    val odjel: String = "",
    val radiliste: String = "",
    val izvodjac: String = "",
    val radnik: String = "",
    val sortimenti: Map<String, Double> = emptyMap(),
    val ukupno: Double = 0.0,
    val timestamp: String = "",
    val imageUrl: String = ""
)

data class OtpremeResponse(
    val otpreme: List<OtpremaUnos> = emptyList(),
    val error: String? = null
)

data class OtpremaUnos(
    val id: String = "",
    val datum: String = "",
    val odjel: String = "",
    val radiliste: String = "",
    val otpremac: String = "",
    val kupac: String = "",
    val brojOtpremnice: String = "",
    val sortimenti: Map<String, Double> = emptyMap(),
    val ukupno: Double = 0.0,
    val timestamp: String = "",
    val imageUrl: String = ""
)

// ─── Primac/Otpremac personal ───────────────────────────────────────────────

data class PersonalResponse(
    val podaci: List<PersonalRow> = emptyList(),
    val ukupno: Map<String, Double> = emptyMap(),
    val sortimentiNazivi: List<String> = emptyList(),
    val mjeseciPodaci: List<MjesecPodatak> = emptyList(),
    val error: String? = null
)

data class PersonalRow(
    val datum: String = "",
    val odjel: String = "",
    val radiliste: String = "",
    val izvodjac: String = "",
    val sortimenti: Map<String, Double> = emptyMap(),
    val ukupno: Double = 0.0
)

data class MjesecPodatak(
    val mjesec: Int = 0,
    val naziv: String = "",
    val ukupno: Double = 0.0,
    val cetinari: Double = 0.0,
    val liscari: Double = 0.0
)

// ─── Poslovodja Radilista ───────────────────────────────────────────────────

data class PoslovodjaRadilistaResponse(
    val radilista: List<String> = emptyList(),
    val error: String? = null
)

// ─── Pending / Dodani unosi ─────────────────────────────────────────────────

data class PendingUnos(
    val id: String = "",
    val tip: String = "",  // SJEČA | OTPREMA
    val datum: String = "",
    val odjel: String = "",
    val radiliste: String = "",
    val radnik: String = "",
    val ukupno: Double = 0.0,
    val timestamp: String = "",
    val imageUrl: String = ""
)

// ─── Sortimenti constants ────────────────────────────────────────────────────

object Sortimenti {
    val CETINARI = listOf("F/L Č", "I Č", "II Č", "III Č", "RD", "TRUPCI Č", "CEL.DUGA", "CEL.CIJEPANA", "ŠKART", "Σ ČETINARI")
    val LISCARI = listOf("F/L L", "I L", "II L", "III L", "TRUPCI L", "OGR.DUGI", "OGR.CIJEPANI", "GULE", "LIŠĆARI")
    val UKUPNO = "UKUPNO Č+L"
    val DB_COLS = mapOf(
        "F/L Č" to "s_fl_c", "I Č" to "s_i_c", "II Č" to "s_ii_c", "III Č" to "s_iii_c",
        "RD" to "s_rd", "TRUPCI Č" to "s_trupci_c", "CEL.DUGA" to "s_cel_duga",
        "CEL.CIJEPANA" to "s_cel_cijepana", "ŠKART" to "s_skart", "Σ ČETINARI" to "s_cetinari",
        "F/L L" to "s_fl_l", "I L" to "s_i_l", "II L" to "s_ii_l", "III L" to "s_iii_l",
        "TRUPCI L" to "s_trupci_l", "OGR.DUGI" to "s_ogr_dugi",
        "OGR.CIJEPANI" to "s_ogr_cijepani", "GULE" to "s_gule",
        "LIŠĆARI" to "s_liscari", "UKUPNO Č+L" to "s_ukupno"
    )
}
