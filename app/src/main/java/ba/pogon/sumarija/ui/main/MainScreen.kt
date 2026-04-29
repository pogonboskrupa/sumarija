package ba.pogon.sumarija.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ba.pogon.sumarija.data.model.User
import ba.pogon.sumarija.data.model.UserType
import ba.pogon.sumarija.ui.screens.dashboard.DashboardScreen
import ba.pogon.sumarija.ui.screens.primaci.PrimaciScreen
import ba.pogon.sumarija.ui.screens.otpremaci.OtpremaciScreen
import ba.pogon.sumarija.ui.screens.stanje.StanjeZalihaScreen
import ba.pogon.sumarija.ui.screens.kupci.KupciScreen
import ba.pogon.sumarija.ui.screens.izvjestaji.IzvjestajiScreen
import ba.pogon.sumarija.ui.screens.poslovodja.PoslovodjaScreen
import ba.pogon.sumarija.ui.screens.primac.PrimacScreen
import ba.pogon.sumarija.ui.screens.otpremac.OtpremacScreen
import ba.pogon.sumarija.ui.theme.NavyBlue

data class TabItem(
    val id: String,
    val label: String,
    val icon: ImageVector,
    val emoji: String = ""
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(user: User, onLogout: () -> Unit) {
    val tabs = remember(user.userType) { getTabsForUser(user.userType) }
    var selectedTab by remember { mutableStateOf(0) }
    var showMenu by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = user.fullName,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                        Text(
                            text = roleLabel(user.userType),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.75f)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = NavyBlue,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                ),
                actions = {
                    IconButton(onClick = { showMenu = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Meni",
                            tint = MaterialTheme.colorScheme.onPrimary)
                    }
                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Odjava") },
                            leadingIcon = { Icon(Icons.Default.Logout, contentDescription = null) },
                            onClick = { showMenu = false; onLogout() }
                        )
                    }
                }
            )
        },
        bottomBar = {
            if (tabs.size <= 5) {
                NavigationBar {
                    tabs.forEachIndexed { idx, tab ->
                        NavigationBarItem(
                            selected = selectedTab == idx,
                            onClick = { selectedTab = idx },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label, maxLines = 1) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = NavyBlue,
                                selectedTextColor = NavyBlue,
                                indicatorColor = NavyBlue.copy(alpha = 0.12f)
                            )
                        )
                    }
                }
            } else {
                // Scrollable tabs for admin (many tabs)
                ScrollableTabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = NavyBlue,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                    edgePadding = 0.dp
                ) {
                    tabs.forEachIndexed { idx, tab ->
                        Tab(
                            selected = selectedTab == idx,
                            onClick = { selectedTab = idx },
                            text = { Text(tab.label, style = MaterialTheme.typography.labelMedium) },
                            icon = { Icon(tab.icon, contentDescription = null, modifier = Modifier.size(18.dp)) }
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues).fillMaxSize()) {
            when (user.userType) {
                UserType.ADMIN -> AdminContent(user, tabs, selectedTab)
                UserType.OPERATIVA -> OperativaContent(user, tabs, selectedTab)
                UserType.PRIMAC -> PrimacScreen(user = user, selectedTab = selectedTab)
                UserType.OTPREMAC -> OtpremacScreen(user = user, selectedTab = selectedTab)
                UserType.POSLOVODJA -> PoslovodjaScreen(user = user, selectedTab = selectedTab)
            }
        }
    }
}

@Composable
private fun AdminContent(user: User, tabs: List<TabItem>, selectedTab: Int) {
    when (tabs.getOrNull(selectedTab)?.id) {
        "dashboard" -> DashboardScreen(user = user)
        "kupci" -> KupciScreen(user = user)
        "stanje-zaliha" -> StanjeZalihaScreen(user = user)
        "primaci" -> PrimaciScreen(user = user)
        "otpremaci" -> OtpremaciScreen(user = user)
        "izvjestaji" -> IzvjestajiScreen(user = user)
        else -> DashboardScreen(user = user)
    }
}

@Composable
private fun OperativaContent(user: User, tabs: List<TabItem>, selectedTab: Int) {
    when (tabs.getOrNull(selectedTab)?.id) {
        "dashboard" -> DashboardScreen(user = user)
        "kupci" -> KupciScreen(user = user)
        "stanje-zaliha" -> StanjeZalihaScreen(user = user)
        "izvjestaji" -> IzvjestajiScreen(user = user)
        else -> DashboardScreen(user = user)
    }
}

private fun getTabsForUser(type: UserType): List<TabItem> = when (type) {
    UserType.PRIMAC -> listOf(
        TabItem("primac-personal", "Sječa", Icons.Default.Forest),
        TabItem("primac-godisnji", "Godišnji", Icons.Default.CalendarMonth),
        TabItem("primac-odjeli", "Odjeli", Icons.Default.Business),
        TabItem("izvjestaji", "Izvještaji", Icons.Default.Description),
        TabItem("add-sjeca", "Dodaj", Icons.Default.Add)
    )
    UserType.OTPREMAC -> listOf(
        TabItem("otpremac-personal", "Otprema", Icons.Default.LocalShipping),
        TabItem("otpremac-godisnji", "Godišnji", Icons.Default.CalendarMonth),
        TabItem("otpremac-odjeli", "Odjeli", Icons.Default.Business),
        TabItem("izvjestaji", "Izvještaji", Icons.Default.Description),
        TabItem("add-otprema", "Dodaj", Icons.Default.Add)
    )
    UserType.POSLOVODJA -> listOf(
        TabItem("poslovodja-sjeca", "Sječa", Icons.Default.Forest),
        TabItem("poslovodja-otprema", "Otprema", Icons.Default.LocalShipping),
        TabItem("stanje-zaliha", "Zalihe", Icons.Default.Inventory),
        TabItem("izvjestaji", "Izvještaji", Icons.Default.Description),
        TabItem("pregled", "Pregled", Icons.Default.TableChart)
    )
    UserType.OPERATIVA -> listOf(
        TabItem("dashboard", "Dashboard", Icons.Default.Dashboard),
        TabItem("kupci", "Kupci", Icons.Default.Business),
        TabItem("stanje-zaliha", "Zalihe", Icons.Default.Inventory),
        TabItem("izvjestaji", "Izvještaji", Icons.Default.Description)
    )
    UserType.ADMIN -> listOf(
        TabItem("dashboard", "Dashboard", Icons.Default.Dashboard),
        TabItem("kupci", "Kupci", Icons.Default.Business),
        TabItem("stanje-zaliha", "Zalihe", Icons.Default.Inventory),
        TabItem("primaci", "Sječa", Icons.Default.Forest),
        TabItem("otpremaci", "Otprema", Icons.Default.LocalShipping),
        TabItem("izvjestaji", "Izvještaji", Icons.Default.Description)
    )
}

private fun roleLabel(type: UserType) = when (type) {
    UserType.ADMIN -> "Administrator"
    UserType.PRIMAC -> "Primač"
    UserType.OTPREMAC -> "Otpremač"
    UserType.POSLOVODJA -> "Poslovođa"
    UserType.OPERATIVA -> "Operativa"
}
