package ba.pogon.sumarija.ui.screens.dashboard

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
import ba.pogon.sumarija.data.model.OdjelDashboard
import ba.pogon.sumarija.data.model.User
import ba.pogon.sumarija.ui.screens.common.*
import ba.pogon.sumarija.ui.theme.*
import java.util.Calendar

@Composable
fun DashboardScreen(
    user: User,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val currentYear = Calendar.getInstance().get(Calendar.YEAR)

    LaunchedEffect(Unit) {
        if (uiState.data == null && !uiState.isLoading) {
            viewModel.load(user, currentYear)
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(BackgroundLight)) {
        // Year selector strip
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(2.dp)
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(Icons.Default.Dashboard, contentDescription = null, tint = NavyBlue, modifier = Modifier.size(20.dp))
                Text("Dashboard", fontWeight = FontWeight.Bold, color = NavyBlue)
                Spacer(Modifier.weight(1f))
                (2024..currentYear).reversed().forEach { year ->
                    FilterChip(
                        selected = uiState.selectedYear == year,
                        onClick = { viewModel.load(user, year) },
                        label = { Text(year.toString(), fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NavyBlue,
                            selectedLabelColor = Color.White
                        )
                    )
                }
                if (uiState.isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = NavyBlue)
                } else {
                    IconButton(onClick = { viewModel.refresh(user) }, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Refresh, contentDescription = null, tint = NavyBlue, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }

        when {
            uiState.isLoading && uiState.data == null -> {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    repeat(3) { ShimmerCard(modifier = Modifier.fillMaxWidth()) }
                }
            }
            uiState.error != null && uiState.data == null -> {
                ErrorView(uiState.error!!) { viewModel.refresh(user) }
            }
            uiState.data != null -> {
                DashboardContent(data = uiState.data!!, year = uiState.selectedYear)
            }
        }
    }
}

@Composable
private fun DashboardContent(data: ba.pogon.sumarija.data.model.DashboardData, year: Int) {
    val ukupno = data.ukupno

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Summary cards
        if (ukupno != null) {
            item {
                Text("Ukupno $year", fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 15.sp,
                    modifier = Modifier.padding(vertical = 4.dp))
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatCard(
                        title = "Sječa - Mjesec",
                        value = "%.0f m³".format(ukupno.sjecaMjesec),
                        color = ColorCetinari,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "Sječa - Godina",
                        value = "%.0f m³".format(ukupno.sjecaGodina),
                        color = ColorCetinari,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatCard(
                        title = "Otprema - Mjesec",
                        value = "%.0f m³".format(ukupno.otpremaMjesec),
                        color = NavyBlue,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "Zalihe",
                        value = "%.0f m³".format(ukupno.zalihe),
                        color = if (ukupno.zalihe > 0) ColorWarning else ColorError,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Odjeli list
        item {
            Text(
                "Po odjelima / radilištima",
                fontWeight = FontWeight.Bold,
                color = NavyBlue,
                fontSize = 15.sp,
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }

        if (data.odjeli.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("Nema podataka za odabrani period", color = TextSecondary)
                    }
                }
            }
        } else {
            items(data.odjeli) { odjel ->
                OdjelCard(odjel)
            }
        }

        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun OdjelCard(odjel: OdjelDashboard) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(2.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(odjel.odjel.ifEmpty { "—" }, fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 14.sp)
                    if (odjel.radiliste.isNotEmpty()) {
                        Text(odjel.radiliste, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                    }
                }
                Box(
                    modifier = Modifier
                        .background(NavyBlue.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text("%.1f m³".format(odjel.zalihe), fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 13.sp)
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MiniStat("Sječa/mj", "%.0f".format(odjel.sjecaMjesec), ColorCetinari, Modifier.weight(1f))
                MiniStat("Sječa/god", "%.0f".format(odjel.sjecaGodina), ColorCetinari, Modifier.weight(1f))
                MiniStat("Otprema/mj", "%.0f".format(odjel.otpremaMjesec), NavyBlue, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun MiniStat(label: String, value: String, color: Color, modifier: Modifier) {
    Column(modifier = modifier.background(color.copy(alpha = 0.06f), RoundedCornerShape(8.dp)).padding(8.dp)) {
        Text(value, fontWeight = FontWeight.Bold, color = color, fontSize = 13.sp)
        Text(label, style = MaterialTheme.typography.labelSmall, color = TextSecondary)
    }
}
