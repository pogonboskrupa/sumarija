-keep class ba.pogon.sumarija.data.model.** { *; }
-keep class ba.pogon.sumarija.data.repository.MobileKorisnik { *; }
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Kotlin Serialization
-keepattributes RuntimeVisibleAnnotations
-keep class kotlinx.serialization.** { *; }
-keepclassmembers class ** {
    @kotlinx.serialization.SerialName <fields>;
}
-keepclasseswithmembers class * {
    @kotlinx.serialization.Serializable <fields>;
}

# Retrofit + OkHttp
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keep class okhttp3.** { *; }
-keep class com.google.gson.** { *; }

# Supabase / Ktor
-keep class io.github.jan.supabase.** { *; }
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**
-dontwarn io.github.jan.supabase.**

# Hilt
-keep class dagger.hilt.** { *; }
-dontwarn dagger.hilt.**

# DataStore
-keep class androidx.datastore.** { *; }
