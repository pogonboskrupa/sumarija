package ba.pogon.sumarija.ui.screens.primaci

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
import ba.pogon.sumarija.data.model.PrimacRow
import ba.pogon.sumarija.data.model.PrimaciResponse
import ba.pogon.sumarija.data.model.User
import ba.pogon.sumarija.data.repository.DataRepository
import ba.pogon.sumarija.ui.screens.common.*
import ba.pogon.sumarija.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar
import javax.inject.Inject

// ─── ViewModel ───────────────────────────────────────────────────────────────

data class PrimaciUiState(
    val isLoading: Boolean = false,
    val data: PrimaciResponse? = null,
    val error: String? = null,
    val year: Int = Calendar.getInstance().get(Calendar.YEAR),
    val search: String = ""
)

@HiltViewModel
class PrimaciViewModel @Inject constructor(private val repo: DataRepository) : ViewModel() {
    private val _s = MutableStateFlow(PrimaciUiState())
    val uiState: StateFlow<PrimaciUiState> = _s.asStateFlow()

    fun load(user: User, year: Int = _s.value.year) {
        viewModelScope.launch {
            _s.value = _s.value.copy(isLoading = true, error = null, year = year)
            val data = repo.loadPrimaci(user, year)
            _s.value = _s.value.copy(isLoading = false, data = data, error = data.error)
        }
    }

    fun setSearch(q: String) { _s.value = _s.value.copy(search = q) }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun PrimaciScreen(user: User, viewModel: PrimaciViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        if (uiState.data == null && !uiState.isLoading) viewModel.load(user)
    }

    Column(modifier = Modifier.fillMaxSize().background(BackgroundLight)) {
        // Toolbar strip
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(2.dp)
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Forest, contentDescription = null, tint = ColorCetinari)
                Text("SJEČA", fontWeight = FontWeight.Bold, color = NavyBlue)
                Spacer(Modifier.weight(1f))
                (listOf(Calendar.getInstance().get(Calendar.YEAR) - 1, Calendar.getInstance().get(Calendar.YEAR))).forEach { year ->
                    FilterChip(
                        selected = uiState.year == year,
                        onClick = { viewModel.load(user, year) },
                        label = { Text(year.toString(), fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = NavyBlue, selectedLabelColor = Color.White)
                    )
                }
                if (uiState.isLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = NavyBlue)
                else IconButton(onClick = { viewModel.load(user) }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = NavyBlue, modifier = Modifier.size(18.dp))
                }
            }
        }

        // Search
        OutlinedTextField(
            value = uiState.search,
            onValueChange = { viewModel.setSearch(it) },
            placeholder = { Text("Pretraži primača...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NavyBlue, cursorColor = NavyBlue)
        )

        Spacer(Modifier.height(8.dp))

        when {
            uiState.isLoading && uiState.data == null -> LoadingView("Učitavam primače...")
            uiState.error != null && uiState.data == null -> ErrorView(uiState.error!!) { viewModel.load(user) }
            uiState.data != null -> PrimaciList(uiState.data!!, uiState.search)
        }
    }
}

@Composable
private fun PrimaciList(data: PrimaciResponse, search: String) {
    val filtered = remember(data.primaci, search) {
        if (search.isBlank()) data.primaci
        else data.primaci.filter { it.primac.contains(search, ignoreCase = true) || it.odjel.contains(search, ignoreCase = true) }
    }
    val ukupnoSveukupno = data.ukupno["UKUPNO Č+L"] ?: data.ukupno.values.sum()

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = ColorCetinari.copy(alpha = 0.08f))
            ) {
                Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Ukupno: ${filtered.size} primača", style = MaterialTheme.typography.bodyMedium, color = ColorCetinari)
                    Text("%.2f m³".format(ukupnoSveukupno), fontWeight = FontWeight.Bold, color = NavyBlue)
                }
            }
        }
        items(filtered, key = { it.primac + it.odjel }) { row -> PrimacCard(row) }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun PrimacCard(row: PrimacRow) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(2.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(row.primac.ifEmpty { "—" }, fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 14.sp)
                    if (row.odjel.isNotEmpty()) Text(row.odjel, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                    if (row.radiliste.isNotEmpty()) Text(row.radiliste, style = MaterialTheme.typography.labelSmall, color = TextHint)
                }
                Box(modifier = Modifier.background(ColorCetinari.copy(alpha = 0.1f), RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 6.dp)) {
                    Text("%.2f m³".format(row.ukupno), fontWeight = FontWeight.Bold, color = ColorCetinari)
                }
            }
            // Show key sortimenti
            val cetinari = row.sortimenti["Σ ČETINARI"] ?: row.sortimenti["ČETINARI"] ?: 0.0
            val liscari = row.sortimenti["LIŠĆARI"] ?: 0.0
            if (cetinari > 0 || liscari > 0) {
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (cetinari > 0) {
                        Chip("Č: %.1f".format(cetinari), ColorCetinari)
                    }
                    if (liscari > 0) {
                        Chip("L: %.1f".format(liscari), ColorLiscari)
                    }
                }
            }
        }
    }
}

@Composable
private fun Chip(text: String, color: Color) {
    Box(modifier = Modifier.background(color.copy(alpha = 0.1f), RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 3.dp)) {
        Text(text, fontSize = 11.sp, color = color, fontWeight = FontWeight.Medium)
    }
}
