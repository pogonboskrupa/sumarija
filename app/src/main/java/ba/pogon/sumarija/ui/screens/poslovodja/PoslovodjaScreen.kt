package ba.pogon.sumarija.ui.screens.poslovodja

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
import ba.pogon.sumarija.data.model.*
import ba.pogon.sumarija.data.repository.DataRepository
import ba.pogon.sumarija.ui.screens.common.*
import ba.pogon.sumarija.ui.screens.izvjestaji.IzvjestajiScreen
import ba.pogon.sumarija.ui.screens.stanje.StanjeZalihaScreen
import ba.pogon.sumarija.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

// ─── ViewModel ───────────────────────────────────────────────────────────────

data class PoslovodjaUiState(
    val isLoading: Boolean = false,
    val primke: List<PrimkaUnos> = emptyList(),
    val otpreme: List<OtpremaUnos> = emptyList(),
    val radilista: List<String> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class PoslovodjaViewModel @Inject constructor(private val repo: DataRepository) : ViewModel() {
    private val _s = MutableStateFlow(PoslovodjaUiState())
    val uiState: StateFlow<PoslovodjaUiState> = _s.asStateFlow()

    fun loadPrimke(user: User) {
        viewModelScope.launch {
            _s.value = _s.value.copy(isLoading = true, error = null)
            val primke = repo.loadPrimke(user)
            val radilista = repo.loadPoslovodjaRadilista(user)
            val filtered = if (radilista.isNotEmpty())
                primke.primke.filter { p -> radilista.any { r -> p.radiliste.equals(r, ignoreCase = true) } }
            else primke.primke
            _s.value = _s.value.copy(isLoading = false, primke = filtered, radilista = radilista, error = primke.error)
        }
    }

    fun loadOtpreme(user: User) {
        viewModelScope.launch {
            _s.value = _s.value.copy(isLoading = true, error = null)
            val otpreme = repo.loadOtpreme(user)
            val radilista = _s.value.radilista.ifEmpty { repo.loadPoslovodjaRadilista(user) }
            val filtered = if (radilista.isNotEmpty())
                otpreme.otpreme.filter { o -> radilista.any { r -> o.radiliste.equals(r, ignoreCase = true) } }
            else otpreme.otpreme
            _s.value = _s.value.copy(isLoading = false, otpreme = filtered, radilista = radilista, error = otpreme.error)
        }
    }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun PoslovodjaScreen(user: User, selectedTab: Int) {
    when (selectedTab) {
        0 -> PoslovodjaSjecaTab(user)
        1 -> PoslovodjaOtpremaTab(user)
        2 -> StanjeZalihaScreen(user)
        3 -> IzvjestajiScreen(user)
        4 -> PoslovodjaPregledTab(user)
        else -> PoslovodjaSjecaTab(user)
    }
}

@Composable
fun PoslovodjaSjecaTab(user: User, viewModel: PoslovodjaViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        if (uiState.primke.isEmpty() && !uiState.isLoading) viewModel.loadPrimke(user)
    }

    Column(modifier = Modifier.fillMaxSize().background(BackgroundLight)) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(2.dp)
        ) {
            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Forest, contentDescription = null, tint = ColorCetinari)
                Spacer(Modifier.width(8.dp))
                Column {
                    Text("SJEČA", fontWeight = FontWeight.Bold, color = NavyBlue)
                    if (uiState.radilista.isNotEmpty()) {
                        Text(uiState.radilista.joinToString(", "), style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                    }
                }
                Spacer(Modifier.weight(1f))
                if (uiState.isLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = NavyBlue)
                else IconButton(onClick = { viewModel.loadPrimke(user) }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = NavyBlue, modifier = Modifier.size(18.dp))
                }
            }
        }

        when {
            uiState.isLoading -> LoadingView("Učitavam primke...")
            uiState.error != null -> ErrorView(uiState.error!!) { viewModel.loadPrimke(user) }
            else -> {
                if (uiState.primke.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Nema primki", color = TextSecondary)
                    }
                } else {
                    val totalM3 = uiState.primke.sumOf { it.ukupno }
                    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                StatCard("Primki", "${uiState.primke.size}", color = ColorCetinari, modifier = Modifier.weight(1f))
                                StatCard("Ukupno m³", "%.1f".format(totalM3), color = NavyBlue, modifier = Modifier.weight(1f))
                            }
                        }
                        items(uiState.primke.sortedByDescending { it.datum }, key = { it.id }) { primka -> PrimkaCard(primka) }
                        item { Spacer(Modifier.height(16.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
fun PrimkaCard(primka: PrimkaUnos) {
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), elevation = CardDefaults.cardElevation(2.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(primka.radnik.ifEmpty { primka.radiliste }, fontWeight = FontWeight.Bold, color = NavyBlue)
                    Text("${primka.datum} • ${primka.odjel}", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                    if (primka.radiliste.isNotEmpty()) Text(primka.radiliste, style = MaterialTheme.typography.labelSmall, color = TextHint)
                }
                Box(modifier = Modifier.background(ColorCetinari.copy(alpha = 0.1f), RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 6.dp)) {
                    Text("%.2f m³".format(primka.ukupno), fontWeight = FontWeight.Bold, color = ColorCetinari)
                }
            }
            if (primka.izvodjac.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Text("Izvođač: ${primka.izvodjac}", style = MaterialTheme.typography.labelSmall, color = TextHint)
            }
        }
    }
}

@Composable
fun PoslovodjaOtpremaTab(user: User, viewModel: PoslovodjaViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        if (uiState.otpreme.isEmpty() && !uiState.isLoading) viewModel.loadOtpreme(user)
    }

    Column(modifier = Modifier.fillMaxSize().background(BackgroundLight)) {
        Card(modifier = Modifier.fillMaxWidth().padding(16.dp), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(2.dp)) {
            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.LocalShipping, contentDescription = null, tint = NavyBlue)
                Spacer(Modifier.width(8.dp))
                Text("OTPREMA", fontWeight = FontWeight.Bold, color = NavyBlue)
                Spacer(Modifier.weight(1f))
                if (uiState.isLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = NavyBlue)
                else IconButton(onClick = { viewModel.loadOtpreme(user) }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = NavyBlue, modifier = Modifier.size(18.dp))
                }
            }
        }
        when {
            uiState.isLoading -> LoadingView("Učitavam otpreme...")
            uiState.error != null -> ErrorView(uiState.error!!) { viewModel.loadOtpreme(user) }
            else -> {
                LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            StatCard("Otprema", "${uiState.otpreme.size}", color = NavyBlue, modifier = Modifier.weight(1f))
                            StatCard("Ukupno m³", "%.1f".format(uiState.otpreme.sumOf { it.ukupno }), color = NavyBlue, modifier = Modifier.weight(1f))
                        }
                    }
                    items(uiState.otpreme.sortedByDescending { it.datum }, key = { it.id }) { otprema ->
                        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), elevation = CardDefaults.cardElevation(2.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(otprema.kupac.ifEmpty { "—" }, fontWeight = FontWeight.Bold, color = NavyBlue)
                                        Text("${otprema.datum} • ${otprema.odjel}", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                                        if (otprema.brojOtpremnice.isNotEmpty()) Text("Otpremnica: ${otprema.brojOtpremnice}", style = MaterialTheme.typography.labelSmall, color = TextHint)
                                    }
                                    Box(modifier = Modifier.background(NavyBlue.copy(alpha = 0.1f), RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 6.dp)) {
                                        Text("%.2f m³".format(otprema.ukupno), fontWeight = FontWeight.Bold, color = NavyBlue)
                                    }
                                }
                            }
                        }
                    }
                    item { Spacer(Modifier.height(16.dp)) }
                }
            }
        }
    }
}

@Composable
fun PoslovodjaPregledTab(user: User) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("📑 Pregled — u razvoju", color = TextSecondary, fontSize = 18.sp)
    }
}
