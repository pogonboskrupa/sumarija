package ba.pogon.sumarija.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ba.pogon.sumarija.data.model.DashboardData
import ba.pogon.sumarija.data.model.User
import ba.pogon.sumarija.data.repository.DataRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar
import javax.inject.Inject

data class DashboardUiState(
    val isLoading: Boolean = false,
    val data: DashboardData? = null,
    val error: String? = null,
    val selectedYear: Int = Calendar.getInstance().get(Calendar.YEAR)
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val repo: DataRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    fun load(user: User, year: Int = _uiState.value.selectedYear) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, selectedYear = year)
            val data = repo.loadDashboard(user, year)
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                data = data,
                error = data.error
            )
        }
    }

    fun refresh(user: User) = load(user)
}
