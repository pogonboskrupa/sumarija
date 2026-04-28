package ba.pogon.sumarija.ui.screens.kupci

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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ba.pogon.sumarija.data.model.KupacRow
import ba.pogon.sumarija.data.model.KupciResponse
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

data class KupciUiState(
    val isLoading: Boolean = false,
    val data: KupciResponse? = null,
    val error: String? = null,
    val year: Int = Calendar.getInstance().get(Calendar.YEAR),
    val search: String = ""
)

@HiltViewModel
class KupciViewModel @Inject constructor(private val repo: DataRepository) : ViewModel() {
    private val _s = MutableStateFlow(KupciUiState())
    val uiState: StateFlow<KupciUiState> = _s.asStateFlow()

    fun load(user: User, year: Int = _s.value.year) {
        viewModelScope.launch {
            _s.value = _s.value.copy(isLoading = true, error = null, year = year)
            val data = repo.loadKupci(user, year)
            _s.value = _s.value.copy(isLoading = false, data = data, error = data.error)
        }
    }

    fun setSearch(q: String) { _s.value = _s.value.copy(search = q) }
}

@Composable
fun KupciScreen(user: User, viewModel: KupciViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        if (uiState.data == null && !uiState.isLoading) viewModel.load(user)
    }

    Column(modifier = Modifier.fillMaxSize().background(BackgroundLight)) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(2.dp)
        ) {
            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.Business, contentDescription = null, tint = NavyBlue)
                Text("Kupci", fontWeight = FontWeight.Bold, color = NavyBlue)
                Spacer(Modifier.weight(1f))
                (listOf(Calendar.getInstance().get(Calendar.YEAR) - 1, Calendar.getInstance().get(Calendar.YEAR))).forEach { year ->
                    FilterChip(
                        selected = uiState.year == year,
                        onClick = { viewModel.load(user, year) },
                        label = { Text(year.toString()) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = NavyBlue, selectedLabelColor = Color.White)
                    )
                }
                if (uiState.isLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = NavyBlue)
                else IconButton(onClick = { viewModel.load(user) }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = NavyBlue, modifier = Modifier.size(18.dp))
                }
            }
        }

        OutlinedTextField(
            value = uiState.search,
            onValueChange = { viewModel.setSearch(it) },
            placeholder = { Text("Pretraži kupca...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            singleLine = true, shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NavyBlue, cursorColor = NavyBlue)
        )
        Spacer(Modifier.height(8.dp))

        when {
            uiState.isLoading && uiState.data == null -> LoadingView("Učitavam kupce...")
            uiState.error != null && uiState.data == null -> ErrorView(uiState.error!!) { viewModel.load(user) }
            uiState.data != null -> KupciList(uiState.data!!, uiState.search)
        }
    }
}

@Composable
private fun KupciList(data: KupciResponse, search: String) {
    val filtered = remember(data.kupci, search) {
        if (search.isBlank()) data.kupci else data.kupci.filter { it.kupac.contains(search, ignoreCase = true) }
    }.sortedByDescending { it.ukupno }

    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NavyBlue.copy(alpha = 0.08f))) {
                Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${filtered.size} kupaca", color = NavyBlue)
                    Text("%.2f m³ ukupno".format(filtered.sumOf { it.ukupno }), fontWeight = FontWeight.Bold, color = NavyBlue)
                }
            }
        }
        items(filtered, key = { it.kupac }) { kupac -> KupacCard(kupac, filtered.indexOf(kupac) + 1) }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun KupacCard(row: KupacRow, rank: Int) {
    val rankColor = when (rank) { 1 -> Color(0xFFFFD700); 2 -> Color(0xFFC0C0C0); 3 -> Color(0xFFCD7F32); else -> TextHint }
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), elevation = CardDefaults.cardElevation(2.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(32.dp).background(rankColor.copy(alpha = 0.15f), RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) {
                Text("#$rank", fontWeight = FontWeight.Bold, color = rankColor)
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(row.kupac.ifEmpty { "—" }, fontWeight = FontWeight.Bold, color = NavyBlue)
            }
            Text("%.2f m³".format(row.ukupno), fontWeight = FontWeight.Bold, color = NavyBlue)
        }
    }
}
