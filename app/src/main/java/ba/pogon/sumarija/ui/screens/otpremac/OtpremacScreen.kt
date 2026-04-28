package ba.pogon.sumarija.ui.screens.otpremac

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
import ba.pogon.sumarija.data.model.User
import ba.pogon.sumarija.ui.screens.common.*
import ba.pogon.sumarija.ui.screens.izvjestaji.IzvjestajiScreen
import ba.pogon.sumarija.ui.screens.primac.PrimacViewModel
import ba.pogon.sumarija.ui.theme.*
import java.util.Calendar

@Composable
fun OtpremacScreen(user: User, selectedTab: Int) {
    when (selectedTab) {
        0 -> OtpremacPersonalTab(user)
        1 -> OtpremacGodisnjiTab(user)
        2 -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text("🏭 Prikaz po odjelima", color = TextSecondary) }
        3 -> IzvjestajiScreen(user)
        4 -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text("➕ Dodaj otpremu — u razvoju", color = TextSecondary, fontSize = 18.sp) }
        else -> OtpremacPersonalTab(user)
    }
}

@Composable
fun OtpremacPersonalTab(user: User, viewModel: PrimacViewModel = hiltViewModel()) {
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
                Icon(Icons.Default.LocalShipping, contentDescription = null, tint = NavyBlue)
                Column(modifier = Modifier.weight(1f)) {
                    Text("Pregled otpreme", fontWeight = FontWeight.Bold, color = NavyBlue)
                    Text(user.fullName, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                }
                (listOf(currentYear - 1, currentYear)).forEach { year ->
                    FilterChip(selected = uiState.year == year, onClick = { viewModel.load(user, year) },
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
            uiState.data != null -> {
                val data = uiState.data!!
                val ukupno = data.ukupno["UKUPNO Č+L"] ?: data.ukupno.values.sum()
                LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            StatCard("Ukupno m³", "%.1f".format(ukupno), color = NavyBlue, modifier = Modifier.weight(1f))
                            StatCard("Unosa", "${data.podaci.size}", color = ForestGreen, modifier = Modifier.weight(1f))
                        }
                    }
                    items(data.podaci.sortedByDescending { it.datum }, key = { it.datum + it.odjel + it.ukupno }) { row ->
                        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), elevation = CardDefaults.cardElevation(1.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                            Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column {
                                    Text(row.datum, fontWeight = FontWeight.Medium, color = NavyBlue)
                                    if (row.odjel.isNotEmpty()) Text(row.odjel, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                                }
                                Text("%.2f m³".format(row.ukupno), fontWeight = FontWeight.Bold, color = NavyBlue)
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
fun OtpremacGodisnjiTab(user: User, viewModel: PrimacViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        if (uiState.data == null && !uiState.isLoading) viewModel.load(user)
    }

    Box(modifier = Modifier.fillMaxSize().background(BackgroundLight).padding(16.dp)) {
        if (uiState.isLoading) LoadingView()
        else Text("📅 Godišnji prikaz otpreme", color = NavyBlue, fontWeight = FontWeight.Bold)
    }
}
