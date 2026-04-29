package ba.pogon.sumarija.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = NavyBlue,
    onPrimary = SurfaceLight,
    primaryContainer = NavyBlueLight,
    onPrimaryContainer = SurfaceLight,
    secondary = ForestGreen,
    onSecondary = SurfaceLight,
    secondaryContainer = ForestGreenLight,
    onSecondaryContainer = SurfaceLight,
    tertiary = ForestGreenDark,
    background = BackgroundLight,
    onBackground = TextPrimary,
    surface = SurfaceLight,
    onSurface = TextPrimary,
    surfaceVariant = CardLight,
    onSurfaceVariant = TextSecondary,
    error = ColorError,
    outline = ColorSeparator
)

private val DarkColorScheme = darkColorScheme(
    primary = NavyBlueLight,
    onPrimary = SurfaceLight,
    secondary = ForestGreenLight,
    onSecondary = NavyBlueDarkTheme,
    background = BackgroundDark,
    onBackground = SurfaceLight,
    surface = SurfaceDark,
    onSurface = SurfaceLight,
    surfaceVariant = NavyBlueDarkTheme,
    error = ColorError
)

@Composable
fun SumarijTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = NavyBlue.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
