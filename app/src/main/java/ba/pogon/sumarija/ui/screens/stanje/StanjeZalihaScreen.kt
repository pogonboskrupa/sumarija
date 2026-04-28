package ba.pogon.sumarija.ui.screens.stanje

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
import ba.pogon.sumarija.data.model.OdjelZaliha
import ba.pogon.sumarija.data.model.StanjeZalihaResponse
import ba.pogon.sumarija.data.model.User
import ba.pogon.sumarija.data.model.UserType
import ba.pogon.sumarija.data.repository.DataRepository
import ba.pogon.sumarija.ui.screens.common.*
import ba.pogon.sumarija.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StanjeUiState(
    val isLoading: Boolean = false,
    val data: StanjeZalihaResponse? = null,
    val error: String? = null,
    val search: String = ""
)

@HiltViewModel
class StanjeZalihaViewModel @Inject constructor(private val repo: DataRepository) : ViewModel() {
    private val _s = MutableStateFlow(StanjeUiState())
    val uiState: StateFlow<StanjeUiState> = _s.asStateFlow()

    fun load(user: User) {
        viewModelScope.launch {
            _s.value = _s.value.copy(isLoading = true, error = null)
            val poslovodja = if (user.userType == UserType.POSLOVODJA) user.fullName else null
            val data = repo.loadStanjeZaliha(user, poslovodja)
            _s.value = _s.value.copy(isLoading = false, data = data, error = data.error)
        }
    }

    fun setSearch(q: String) { _s.value = _s.value.copy(search = q) }
}

@Composable
fun StanjeZalihaScreen(user: User, viewModel: StanjeZalihaViewModel = hiltViewModel()) {
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
            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Inventory, contentDescription = null, tint = NavyBlue)
                Spacer(Modifier.width(8.dp))
                Text("Stanje Zaliha", fontWeight = FontWeight.Bold, color = NavyBlue)
                Spacer(Modifier.weight(1f))
                if (uiState.isLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = NavyBlue)
                else IconButton(onClick = { viewModel.load(user) }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = NavyBlue, modifier = Modifier.size(18.dp))
                }
            }
        }

        OutlinedTextField(
            value = uiState.search,
            onValueChange = { viewModel.setSearch(it) },
            placeholder = { Text("Pretraži odjel / radilište...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NavyBlue, cursorColor = NavyBlue)
        )

        Spacer(Modifier.height(8.dp))

        when {
            uiState.isLoading && uiState.data == null -> LoadingView("Učitavam stanje zaliha...")
            uiState.error != null && uiState.data == null -> ErrorView(uiState.error!!) { viewModel.load(user) }
            uiState.data != null -> StanjeList(uiState.data!!, uiState.search)
        }
    }
}

@Composable
private fun StanjeList(data: StanjeZalihaResponse, search: String) {
    val filtered = remember(data.odjeli, search) {
        if (search.isBlank()) data.odjeli
        else data.odjeli.filter { it.odjel.contains(search, ignoreCase = true) || it.radiliste.contains(search, ignoreCase = true) }
    }
    val totalZalihe = filtered.sumOf { it.zalihe }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("Ukupne zalihe", "%.0f m³".format(totalZalihe),
                    color = if (totalZalihe > 0) ColorWarning else ColorError, modifier = Modifier.weight(1f))
                StatCard("Odjela", "${filtered.size}", color = NavyBlue, modifier = Modifier.weight(1f))
            }
        }

        items(filtered, key = { it.odjel + it.radiliste }) { odjel -> ZalihaCard(odjel) }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun ZalihaCard(odjel: OdjelZaliha) {
    val zaliheColor = when {
        odjel.zalihe > 500 -> ColorError
        odjel.zalihe > 200 -> ColorWarning
        else -> ColorSuccess
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(2.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(odjel.odjel.ifEmpty { "—" }, fontWeight = FontWeight.Bold, color = NavyBlue)
                    if (odjel.radiliste.isNotEmpty()) Text(odjel.radiliste, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                }
                Box(
                    modifier = Modifier.background(zaliheColor.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Text("%.1f m³".format(odjel.zalihe), fontWeight = FontWeight.Bold, color = zaliheColor, fontSize = 14.sp)
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(modifier = Modifier.weight(1f).background(ColorCetinari.copy(alpha = 0.06f), RoundedCornerShape(8.dp)).padding(8.dp)) {
                    Column {
                        Text("%.1f m³".format(odjel.sjecaUkupno), fontWeight = FontWeight.Bold, color = ColorCetinari, fontSize = 13.sp)
                        Text("Sječa", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                    }
                }
                Box(modifier = Modifier.weight(1f).background(NavyBlue.copy(alpha = 0.06f), RoundedCornerShape(8.dp)).padding(8.dp)) {
                    Column {
                        Text("%.1f m³".format(odjel.otpremaUkupno), fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 13.sp)
                        Text("Otprema", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                    }
                }
            }
        }
    }
}
