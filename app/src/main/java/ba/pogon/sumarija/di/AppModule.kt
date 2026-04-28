package ba.pogon.sumarija.di

import android.content.Context
import ba.pogon.sumarija.data.local.PrefsManager
import ba.pogon.sumarija.data.repository.AuthRepository
import ba.pogon.sumarija.data.repository.DataRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun providePrefsManager(@ApplicationContext context: Context): PrefsManager =
        PrefsManager(context)

    @Provides
    @Singleton
    fun provideAuthRepository(prefs: PrefsManager): AuthRepository =
        AuthRepository(prefs)

    @Provides
    @Singleton
    fun provideDataRepository(prefs: PrefsManager): DataRepository =
        DataRepository(prefs)
}
