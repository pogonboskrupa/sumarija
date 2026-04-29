package ba.pogon.sumarija.ui.screens.common

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ba.pogon.sumarija.ui.theme.*

// ─── Loading & Error ─────────────────────────────────────────────────────────

@Composable
fun LoadingView(message: String = "Učitavam...") {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(color = NavyBlue, strokeWidth = 3.dp)
            Text(message, color = TextSecondary, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
fun ErrorView(message: String, onRetry: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = ColorError, modifier = Modifier.size(48.dp))
            Text("Greška", style = MaterialTheme.typography.titleLarge, color = ColorError, fontWeight = FontWeight.Bold)
            Text(message, style = MaterialTheme.typography.bodyMedium, color = TextSecondary, textAlign = TextAlign.Center)
            Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = NavyBlue)) {
                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Pokušaj ponovo")
            }
        }
    }
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

@Composable
fun StatCard(
    title: String,
    value: String,
    subtitle: String = "",
    color: Color = NavyBlue,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(color.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Box(modifier = Modifier.size(12.dp).clip(RoundedCornerShape(3.dp)).background(color))
            }
            Spacer(Modifier.height(12.dp))
            Text(value, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = color)
            Text(title, style = MaterialTheme.typography.bodySmall, color = TextSecondary, maxLines = 1)
            if (subtitle.isNotEmpty()) {
                Text(subtitle, style = MaterialTheme.typography.labelSmall, color = TextHint, maxLines = 1)
            }
        }
    }
}

// ─── Section Header ──────────────────────────────────────────────────────────

@Composable
fun SectionHeader(title: String, subtitle: String = "") {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = NavyBlue)
        if (subtitle.isNotEmpty()) {
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
        }
    }
}

// ─── Data Row ────────────────────────────────────────────────────────────────

@Composable
fun DataRow(label: String, value: String, isHeader: Boolean = false, isTotal: Boolean = false) {
    val bgColor = when {
        isHeader -> NavyBlue
        isTotal -> ForestGreen.copy(alpha = 0.1f)
        else -> Color.Transparent
    }
    val textColor = if (isHeader) Color.White else TextPrimary
    val fontWeight = if (isHeader || isTotal) FontWeight.Bold else FontWeight.Normal

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(bgColor)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = textColor, fontWeight = fontWeight, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodyMedium, color = textColor, fontWeight = fontWeight)
    }
    if (!isHeader) {
        HorizontalDivider(color = ColorSeparator, thickness = 0.5.dp)
    }
}

// ─── Year/Month Selector ─────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun YearMonthSelector(
    selectedYear: Int,
    selectedMonth: Int,
    onYearChange: (Int) -> Unit,
    onMonthChange: (Int) -> Unit
) {
    val years = (2024..2026).toList()
    val months = listOf("Januar","Februar","Mart","April","Maj","Juni","Juli","August","Septembar","Oktobar","Novembar","Decembar")

    var yearExpanded by remember { mutableStateOf(false) }
    var monthExpanded by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Year
        ExposedDropdownMenuBox(
            expanded = yearExpanded,
            onExpandedChange = { yearExpanded = it },
            modifier = Modifier.weight(1f)
        ) {
            OutlinedTextField(
                value = selectedYear.toString(),
                onValueChange = {},
                readOnly = true,
                label = { Text("Godina") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = yearExpanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NavyBlue, focusedLabelColor = NavyBlue)
            )
            ExposedDropdownMenu(expanded = yearExpanded, onDismissRequest = { yearExpanded = false }) {
                years.forEach { year ->
                    DropdownMenuItem(
                        text = { Text(year.toString()) },
                        onClick = { onYearChange(year); yearExpanded = false }
                    )
                }
            }
        }

        // Month
        ExposedDropdownMenuBox(
            expanded = monthExpanded,
            onExpandedChange = { monthExpanded = it },
            modifier = Modifier.weight(1.5f)
        ) {
            OutlinedTextField(
                value = months.getOrElse(selectedMonth) { "Januar" },
                onValueChange = {},
                readOnly = true,
                label = { Text("Mjesec") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = monthExpanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NavyBlue, focusedLabelColor = NavyBlue)
            )
            ExposedDropdownMenu(expanded = monthExpanded, onDismissRequest = { monthExpanded = false }) {
                months.forEachIndexed { idx, month ->
                    DropdownMenuItem(
                        text = { Text(month) },
                        onClick = { onMonthChange(idx); monthExpanded = false }
                    )
                }
            }
        }
    }
}

// ─── Shimmer loading ─────────────────────────────────────────────────────────

@Composable
fun ShimmerCard(modifier: Modifier = Modifier) {
    val shimmerColors = listOf(Color(0xFFE0E0E0), Color(0xFFF5F5F5), Color(0xFFE0E0E0))
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateX by transition.animateFloat(
        initialValue = -1000f, targetValue = 1000f,
        animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Restart),
        label = "shimmer_translate"
    )
    val brush = Brush.linearGradient(
        shimmerColors,
        start = Offset(translateX, 0f),
        end = Offset(translateX + 500f, 0f)
    )
    Card(
        modifier = modifier.height(90.dp),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize().background(brush))
    }
}

// ─── Horizontal scrollable table ─────────────────────────────────────────────

@Composable
fun ScrollableDataTable(
    headers: List<String>,
    rows: List<List<String>>,
    totalRow: List<String>? = null
) {
    val scrollState = rememberScrollState()
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.horizontalScroll(scrollState)) {
            // Header
            Row(modifier = Modifier.background(NavyBlue).padding(8.dp)) {
                headers.forEach { h ->
                    Text(
                        h, color = Color.White, fontWeight = FontWeight.Bold,
                        fontSize = 11.sp, textAlign = TextAlign.Center,
                        modifier = Modifier.width(if (h == headers.first()) 140.dp else 80.dp).padding(horizontal = 4.dp)
                    )
                }
            }
            // Data rows
            rows.forEachIndexed { idx, row ->
                val bg = if (idx % 2 == 0) Color.White else ColorRowAlt
                Row(modifier = Modifier.background(bg).padding(8.dp)) {
                    row.forEachIndexed { ci, cell ->
                        Text(
                            cell, fontSize = 11.sp, textAlign = if (ci == 0) TextAlign.Start else TextAlign.Center,
                            modifier = Modifier.width(if (ci == 0) 140.dp else 80.dp).padding(horizontal = 4.dp),
                            maxLines = 2
                        )
                    }
                }
                HorizontalDivider(color = ColorSeparator, thickness = 0.5.dp)
            }
            // Total row
            if (totalRow != null) {
                Row(modifier = Modifier.background(ForestGreen.copy(alpha = 0.1f)).padding(8.dp)) {
                    totalRow.forEachIndexed { ci, cell ->
                        Text(
                            cell, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                            textAlign = if (ci == 0) TextAlign.Start else TextAlign.Center,
                            color = NavyBlue,
                            modifier = Modifier.width(if (ci == 0) 140.dp else 80.dp).padding(horizontal = 4.dp)
                        )
                    }
                }
            }
        }
    }
}
