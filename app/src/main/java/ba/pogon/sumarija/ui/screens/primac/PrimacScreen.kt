package ba.pogon.sumarija.ui.screens.primac

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ba.pogon.sumarija.data.model.MjesecPodatak
import ba.pogon.sumarija.data.model.PersonalResponse
import ba.pogon.sumarija.data.model.User
import ba.pogon.sumarija.data.repository.DataRepository
import ba.pogon.sumarija.ui.screens.common.*
import ba.pogon.sumarija.ui.screens.izvjestaji.IzvjestajiScreen
import ba.pogon.sumarija.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar
import javax.inject.Inject

data class PrimacUiState(
    val isLoading: Boolean = false,
    val data: PersonalResponse? = null,
    val error: String? = null,
    val year: Int = Calendar.getInstance().get(Calendar.YEAR)
)

@HiltViewModel
class PrimacViewModel @Inject constructor(private val repo: DataRepository) : ViewModel() {
    private val _s = MutableStateFlow(PrimacUiState())
    val uiState: StateFlow<PrimacUiState> = _s.asStateFlow()

    fun load(user: User, year: Int = _s.value.year) {
        viewModelScope.launch {
            _s.value = _s.value.copy(isLoading = true, error = null, year = year)
            val data = repo.loadPersonal(user, year)
            _s.value = _s.value.copy(isLoading = false, data = data, error = data.error)
        }
    }
}

@Composable
fun PrimacScreen(user: User, selectedTab: Int) {
    when (selectedTab) {
        0 -> PrimacPersonalTab(user)
        1 -> PrimacGodisnjiTab(user)
        2 -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text("🏭 Prikaz po odjelima", color = TextSecondary) }
        3 -> IzvjestajiScreen(user)
        4 -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text("➕ Dodaj sječu — u razvoju", color = TextSecondary, fontSize = 18.sp) }
        else -> PrimacPersonalTab(user)
    }
}

@Composable
fun PrimacPersonalTab(user: User, viewModel: PrimacViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val currentYear = Calendar.getInstance().get(Calendar.YEAR)

    LaunchedEffect(Unit) {
        if (uiState.data == null && !uiState.isLoading) viewModel.load(user, currentYear)
    }

    Column(modifier = Modifier.fillMaxSize().background(BackgroundLight)) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(2.dp)
        ) {
            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.Person, contentDescription = null, tint = ColorCetinari)
                Column(modifier = Modifier.weight(1f)) {
                    Text("Pregled sječe", fontWeight = FontWeight.Bold, color = NavyBlue)
                    Text(user.fullName, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                }
                (listOf(currentYear - 1, currentYear)).forEach { year ->
                    FilterChip(
                        selected = uiState.year == year,
                        onClick = { viewModel.load(user, year) },
                        label = { Text(year.toString(), fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = NavyBlue, selectedLabelColor = Color.White)
                    )
                }
                if (uiState.isLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = NavyBlue)
            }
        }

        when {
            uiState.isLoading && uiState.data == null -> LoadingView("Učitavam podatke...")
            uiState.error != null && uiState.data == null -> ErrorView(uiState.error!!) { viewModel.load(user) }
            uiState.data != null -> PrimacPersonalContent(uiState.data!!)
        }
    }
}

@Composable
private fun PrimacPersonalContent(data: PersonalResponse) {
    val ukupno = data.ukupno["UKUPNO Č+L"] ?: data.ukupno["s_ukupno"] ?: data.ukupno.values.sum()
    val cetinari = data.ukupno["Σ ČETINARI"] ?: data.ukupno["s_cetinari"] ?: 0.0
    val liscari = data.ukupno["LIŠĆARI"] ?: data.ukupno["s_liscari"] ?: 0.0

    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("Ukupno m³", "%.1f".format(ukupno), color = NavyBlue, modifier = Modifier.weight(1f))
                StatCard("Četinari", "%.1f".format(cetinari), color = ColorCetinari, modifier = Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("Lišćari", "%.1f".format(liscari), color = ColorLiscari, modifier = Modifier.weight(1f))
                StatCard("Unosa", "${data.podaci.size}", color = ForestGreen, modifier = Modifier.weight(1f))
            }
        }
        item { SectionHeader("Unosi", "Sortirano po datumu") }
        items(data.podaci.sortedByDescending { it.datum }, key = { it.datum + it.odjel + it.ukupno }) { row ->
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), elevation = CardDefaults.cardElevation(1.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text(row.datum, fontWeight = FontWeight.Medium, color = NavyBlue)
                        if (row.odjel.isNotEmpty()) Text(row.odjel, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                        if (row.radiliste.isNotEmpty()) Text(row.radiliste, style = MaterialTheme.typography.labelSmall, color = TextHint)
                    }
                    Text("%.2f m³".format(row.ukupno), fontWeight = FontWeight.Bold, color = ColorCetinari)
                }
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
fun PrimacGodisnjiTab(user: User, viewModel: PrimacViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        if (uiState.data == null && !uiState.isLoading) viewModel.load(user)
    }

    Column(modifier = Modifier.fillMaxSize().background(BackgroundLight).padding(16.dp)) {
        Text("📅 Godišnji prikaz", fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 16.sp)
        Spacer(Modifier.height(12.dp))

        when {
            uiState.isLoading -> LoadingView()
            uiState.data?.mjeseciPodaci?.isNotEmpty() == true -> {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(uiState.data!!.mjeseciPodaci) { mj -> MjesecCard(mj) }
                }
            }
            else -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Nema godišnjih podataka", color = TextSecondary)
            }
        }
    }
}

@Composable
private fun MjesecCard(mj: MjesecPodatak) {
    val monthNames = listOf("Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec")
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), elevation = CardDefaults.cardElevation(2.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(42.dp).background(NavyBlue.copy(alpha = 0.1f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
                Text(monthNames.getOrElse(mj.mjesec - 1) { "?" }, fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 13.sp)
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text("%.2f m³".format(mj.ukupno), fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 15.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Č: %.1f".format(mj.cetinari), fontSize = 11.sp, color = ColorCetinari)
                    Text("L: %.1f".format(mj.liscari), fontSize = 11.sp, color = ColorLiscari)
                }
            }
        }
    }
}
