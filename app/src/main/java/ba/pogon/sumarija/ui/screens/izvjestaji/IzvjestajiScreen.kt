package ba.pogon.sumarija.ui.screens.izvjestaji

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ba.pogon.sumarija.data.model.DailyResponse
import ba.pogon.sumarija.data.model.DailyRow
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

// ─── Week ────────────────────────────────────────────────────────────────────

data class Week(val weekNum: Int, val start: Int, val end: Int, val label: String, val dateRange: String)

fun calculateWeeks(year: Int, month: Int): List<Week> {
    val cal = Calendar.getInstance()
    cal.set(year, month, 1)
    val daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
    val weeks = mutableListOf<Week>()
    var weekStart = 1

    while (weekStart <= daysInMonth) {
        var weekEnd = weekStart
        val tmp = Calendar.getInstance()
        tmp.set(year, month, weekStart)
        while (tmp.get(Calendar.DAY_OF_WEEK) != Calendar.SUNDAY && weekEnd < daysInMonth) {
            weekEnd++
            tmp.set(year, month, weekEnd)
        }
        val mm = String.format("%02d", month + 1)
        weeks.add(Week(
            weekNum = weeks.size + 1,
            start = weekStart, end = weekEnd,
            label = "S${weeks.size + 1}",
            dateRange = "${String.format("%02d", weekStart)}.$mm - ${String.format("%02d", weekEnd)}.$mm"
        ))
        weekStart = weekEnd + 1
    }
    return weeks
}

fun dayFromDatum(datum: String): Int? {
    val parts = datum.split("/", ".", "-")
    return parts.firstOrNull()?.trim()?.toIntOrNull()
}

// ─── ViewModel ───────────────────────────────────────────────────────────────

data class IzvjestajiUiState(
    val isLoading: Boolean = false,
    val primkaDaily: DailyResponse? = null,
    val otpremaDaily: DailyResponse? = null,
    val error: String? = null,
    val year: Int = Calendar.getInstance().get(Calendar.YEAR),
    val month: Int = Calendar.getInstance().get(Calendar.MONTH),
    val selectedSubTab: Int = 0  // 0=Sedmični, 1=Sedmični po radniku, 2=Mjesečni
)

@HiltViewModel
class IzvjestajiViewModel @Inject constructor(private val repo: DataRepository) : ViewModel() {
    private val _s = MutableStateFlow(IzvjestajiUiState())
    val uiState: StateFlow<IzvjestajiUiState> = _s.asStateFlow()

    fun load(user: User, year: Int = _s.value.year, month: Int = _s.value.month) {
        viewModelScope.launch {
            _s.value = _s.value.copy(isLoading = true, error = null, year = year, month = month)
            val primka = repo.loadPrimaciDaily(user, year, month)
            val otprema = repo.loadOtpremaciDaily(user, year, month)
            _s.value = _s.value.copy(
                isLoading = false,
                primkaDaily = if (primka.error == null) primka else null,
                otpremaDaily = if (otprema.error == null) otprema else null,
                error = primka.error ?: otprema.error
            )
        }
    }

    fun selectSubTab(idx: Int) { _s.value = _s.value.copy(selectedSubTab = idx) }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun IzvjestajiScreen(user: User, viewModel: IzvjestajiViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        if (uiState.primkaDaily == null && !uiState.isLoading) viewModel.load(user)
    }

    Column(modifier = Modifier.fillMaxSize().background(BackgroundLight)) {
        // Year/Month selector
        YearMonthSelector(
            selectedYear = uiState.year,
            selectedMonth = uiState.month,
            onYearChange = { viewModel.load(user, it, uiState.month) },
            onMonthChange = { viewModel.load(user, uiState.year, it) }
        )

        // Sub-tabs
        val subTabs = listOf("📊 Sedmični", "👷 Po radniku", "📅 Mjesečni")
        ScrollableTabRow(
            selectedTabIndex = uiState.selectedSubTab,
            containerColor = Color.White,
            contentColor = NavyBlue,
            edgePadding = 8.dp,
            divider = { HorizontalDivider(color = ColorSeparator) }
        ) {
            subTabs.forEachIndexed { idx, title ->
                Tab(
                    selected = uiState.selectedSubTab == idx,
                    onClick = { viewModel.selectSubTab(idx) },
                    text = { Text(title, style = MaterialTheme.typography.labelMedium) }
                )
            }
        }

        when {
            uiState.isLoading -> LoadingView("Učitavam izvještaj...")
            uiState.error != null && uiState.primkaDaily == null -> ErrorView(uiState.error!!) { viewModel.load(user) }
            else -> {
                val weeks = remember(uiState.year, uiState.month) { calculateWeeks(uiState.year, uiState.month) }
                when (uiState.selectedSubTab) {
                    0 -> SedmicniContent(
                        primkaData = uiState.primkaDaily?.data ?: emptyList(),
                        primkaNazivi = uiState.primkaDaily?.sortimentiNazivi ?: emptyList(),
                        otpremaData = uiState.otpremaDaily?.data ?: emptyList(),
                        otpremaNazivi = uiState.otpremaDaily?.sortimentiNazivi ?: emptyList(),
                        weeks = weeks, keyField = "odjel", groupLabel = "Odjel"
                    )
                    1 -> SedmicniContent(
                        primkaData = uiState.primkaDaily?.data ?: emptyList(),
                        primkaNazivi = uiState.primkaDaily?.sortimentiNazivi ?: emptyList(),
                        otpremaData = uiState.otpremaDaily?.data ?: emptyList(),
                        otpremaNazivi = uiState.otpremaDaily?.sortimentiNazivi ?: emptyList(),
                        weeks = weeks, keyField = "primac", groupLabel = "Radnik"
                    )
                    2 -> MjesecniContent(
                        primkaData = uiState.primkaDaily?.data ?: emptyList(),
                        primkaNazivi = uiState.primkaDaily?.sortimentiNazivi ?: emptyList(),
                        otpremaData = uiState.otpremaDaily?.data ?: emptyList(),
                        otpremaNazivi = uiState.otpremaDaily?.sortimentiNazivi ?: emptyList()
                    )
                }
            }
        }
    }
}

// ─── Sedmični table content ───────────────────────────────────────────────────

@Composable
fun SedmicniContent(
    primkaData: List<DailyRow>,
    primkaNazivi: List<String>,
    otpremaData: List<DailyRow>,
    otpremaNazivi: List<String>,
    weeks: List<Week>,
    keyField: String,
    groupLabel: String
) {
    val primakaGrouped = remember(primkaData, weeks, keyField) { groupByWeekAndKey(primkaData, weeks, keyField) }
    val otpremaGrouped = remember(otpremaData, weeks, keyField) {
        val otpremaKey = if (keyField == "primac") "otpremac" else keyField
        groupByWeekAndKey(otpremaData, weeks, otpremaKey)
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text("🌲 Sječa po $groupLabel", fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 15.sp)
        }
        item {
            WeeklyTableCard(primakaGrouped, primkaNazivi, weeks, groupLabel)
        }
        item {
            Text("🚛 Otprema po $groupLabel", fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 15.sp)
        }
        item {
            WeeklyTableCard(otpremaGrouped, otpremaNazivi, weeks, groupLabel)
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

fun groupByWeekAndKey(data: List<DailyRow>, weeks: List<Week>, keyField: String): Map<Int, Map<String, Map<String, Double>>> {
    val result = weeks.associate { it.weekNum to mutableMapOf<String, MutableMap<String, Double>>() }.toMutableMap()
    data.forEach { row ->
        val day = dayFromDatum(row.datum) ?: return@forEach
        val week = weeks.find { day in it.start..it.end } ?: return@forEach
        val key = when (keyField) {
            "odjel" -> row.odjel
            "primac" -> row.primac
            "otpremac" -> row.otpremac
            else -> row.odjel
        }.ifEmpty { "Nepoznat" }
        val weekMap = result.getOrPut(week.weekNum) { mutableMapOf() }
        val keyMap = weekMap.getOrPut(key) { mutableMapOf() }
        row.sortimenti.forEach { (s, v) -> keyMap[s] = (keyMap[s] ?: 0.0) + v }
    }
    return result
}

@Composable
fun WeeklyTableCard(
    grouped: Map<Int, Map<String, Map<String, Double>>>,
    sortimentiNazivi: List<String>,
    weeks: List<Week>,
    groupLabel: String
) {
    val displayCols = sortimentiNazivi.filter { it == "Σ ČETINARI" || it == "LIŠĆARI" || it == "UKUPNO Č+L" || it == "SVEUKUPNO" }
        .ifEmpty { sortimentiNazivi.takeLast(3) }

    if (grouped.values.all { it.isEmpty() }) {
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
            Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                Text("Nema podataka", color = TextSecondary)
            }
        }
        return
    }

    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), elevation = CardDefaults.cardElevation(2.dp)) {
        val hScroll = rememberScrollState()
        Column(modifier = Modifier.horizontalScroll(hScroll)) {
            // Header
            Row(modifier = Modifier.background(NavyBlue).padding(vertical = 8.dp, horizontal = 4.dp)) {
                TableCell("SEDMICA", isHeader = true, width = 70)
                TableCell(groupLabel, isHeader = true, width = 120)
                displayCols.forEach { col -> TableCell(col.replace(" ", "\n"), isHeader = true, width = 70) }
            }
            weeks.forEach { week ->
                val weekData = grouped[week.weekNum] ?: emptyMap()
                if (weekData.isEmpty()) return@forEach

                val keys = weekData.keys.sorted()
                // Week totals row
                val weekTotals = displayCols.associateWith { col -> weekData.values.sumOf { it[col] ?: 0.0 } }
                Row(modifier = Modifier.background(NavyBlue.copy(alpha = 0.08f)).padding(vertical = 6.dp, horizontal = 4.dp)) {
                    TableCell(week.label + "\n" + week.dateRange, width = 70, isBold = true)
                    TableCell("UKUPNO", width = 120, isBold = true)
                    displayCols.forEach { col -> TableCell("%.1f".format(weekTotals[col] ?: 0.0), width = 70, isBold = true) }
                }
                // Detail rows
                keys.forEachIndexed { idx, key ->
                    val bg = if (idx % 2 == 0) Color.White else ColorRowAlt
                    Row(modifier = Modifier.background(bg).padding(vertical = 5.dp, horizontal = 4.dp)) {
                        TableCell("", width = 70)
                        TableCell(key, width = 120)
                        displayCols.forEach { col ->
                            val v = weekData[key]?.get(col) ?: 0.0
                            TableCell(if (v > 0) "%.1f".format(v) else "—", width = 70)
                        }
                    }
                    HorizontalDivider(color = ColorSeparator, thickness = 0.5.dp)
                }
            }
            // Grand total
            val grandTotals = displayCols.associateWith { col -> grouped.values.flatMap { it.values }.sumOf { it[col] ?: 0.0 } }
            Row(modifier = Modifier.background(ForestGreen.copy(alpha = 0.12f)).padding(vertical = 8.dp, horizontal = 4.dp)) {
                TableCell("UKUPNO", width = 70, isBold = true)
                TableCell("MJESEC", width = 120, isBold = true)
                displayCols.forEach { col -> TableCell("%.1f".format(grandTotals[col] ?: 0.0), width = 70, isBold = true, color = NavyBlue) }
            }
        }
    }
}

@Composable
fun TableCell(text: String, isHeader: Boolean = false, isBold: Boolean = false, width: Int = 80, color: Color = Color.Unspecified) {
    val textColor = when { isHeader -> Color.White; color != Color.Unspecified -> color; else -> TextPrimary }
    Text(
        text = text,
        modifier = Modifier.width(width.dp).padding(horizontal = 4.dp),
        color = textColor,
        fontWeight = if (isHeader || isBold) FontWeight.Bold else FontWeight.Normal,
        fontSize = 11.sp,
        textAlign = TextAlign.Center,
        maxLines = 3
    )
}

// ─── Mjesečni content ────────────────────────────────────────────────────────

@Composable
fun MjesecniContent(
    primkaData: List<DailyRow>,
    primkaNazivi: List<String>,
    otpremaData: List<DailyRow>,
    otpremaNazivi: List<String>
) {
    val primkaByOdjel = remember(primkaData) { groupByOdjel(primkaData) }
    val otpremaByOdjel = remember(otpremaData) { groupByOdjel(otpremaData) }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Text("🌲 Sječa po odjelima", fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 15.sp) }
        item { MjesecniTable(primkaByOdjel, primkaNazivi) }
        item { Text("🚛 Otprema po odjelima", fontWeight = FontWeight.Bold, color = NavyBlue, fontSize = 15.sp) }
        item { MjesecniTable(otpremaByOdjel, otpremaNazivi) }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

fun groupByOdjel(data: List<DailyRow>): Map<String, Map<String, Double>> {
    val result = mutableMapOf<String, MutableMap<String, Double>>()
    data.forEach { row ->
        val key = row.odjel.ifEmpty { "Nepoznat" }
        val keyMap = result.getOrPut(key) { mutableMapOf() }
        row.sortimenti.forEach { (s, v) -> keyMap[s] = (keyMap[s] ?: 0.0) + v }
    }
    return result
}

@Composable
fun MjesecniTable(grouped: Map<String, Map<String, Double>>, sortimentiNazivi: List<String>) {
    val displayCols = sortimentiNazivi.filter { it == "Σ ČETINARI" || it == "LIŠĆARI" || it == "UKUPNO Č+L" }
        .ifEmpty { sortimentiNazivi.takeLast(3) }

    if (grouped.isEmpty()) {
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
            Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                Text("Nema podataka", color = TextSecondary)
            }
        }
        return
    }

    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), elevation = CardDefaults.cardElevation(2.dp)) {
        val hScroll = rememberScrollState()
        Column(modifier = Modifier.horizontalScroll(hScroll)) {
            Row(modifier = Modifier.background(NavyBlue).padding(vertical = 8.dp, horizontal = 4.dp)) {
                TableCell("Odjel", isHeader = true, width = 140)
                displayCols.forEach { col -> TableCell(col.replace(" ", "\n"), isHeader = true, width = 80) }
            }
            grouped.entries.sortedByDescending { e -> displayCols.lastOrNull()?.let { e.value[it] } ?: 0.0 }
                .forEachIndexed { idx, (odjel, sortimenti) ->
                    val bg = if (idx % 2 == 0) Color.White else ColorRowAlt
                    Row(modifier = Modifier.background(bg).padding(vertical = 6.dp, horizontal = 4.dp)) {
                        TableCell(odjel, width = 140)
                        displayCols.forEach { col ->
                            val v = sortimenti[col] ?: 0.0
                            TableCell(if (v > 0) "%.2f".format(v) else "—", width = 80)
                        }
                    }
                    HorizontalDivider(color = ColorSeparator, thickness = 0.5.dp)
                }
            val totals = displayCols.associateWith { col -> grouped.values.sumOf { it[col] ?: 0.0 } }
            Row(modifier = Modifier.background(ForestGreen.copy(alpha = 0.12f)).padding(vertical = 8.dp, horizontal = 4.dp)) {
                TableCell("UKUPNO", width = 140, isBold = true)
                displayCols.forEach { col -> TableCell("%.2f".format(totals[col] ?: 0.0), width = 80, isBold = true, color = NavyBlue) }
            }
        }
    }
}
