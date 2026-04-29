package ba.pogon.sumarija.data.api

import com.google.gson.JsonObject
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.QueryMap
import retrofit2.http.Url

interface ApiService {
    // Generic endpoint — all GAS calls go through one URL with query params
    @GET
    suspend fun call(
        @Url url: String,
        @QueryMap params: Map<String, String>
    ): Response<JsonObject>

    // Raw call for cases where we need the ResponseBody directly
    @GET
    suspend fun callRaw(@Url url: String): Response<ResponseBody>
}
